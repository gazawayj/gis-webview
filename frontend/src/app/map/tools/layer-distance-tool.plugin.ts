import Feature from 'ol/Feature';
import { LineString, MultiPolygon, Point, Polygon } from 'ol/geom';
import { getLength } from 'ol/sphere';
import { PLANETS } from '../constants/map-constants';
import { ToolPluginBase } from './tool-base.plugin';
import { LayerConfig } from '../models/layer-config.model';
import { OverlayRef } from '@angular/cdk/overlay';
import { toLonLat } from 'ol/proj';
import { KDTree } from '../utils/map-utils';

export class LayerDistanceToolPlugin extends ToolPluginBase {
  name = 'layer-distance';
  selectedLayers: [LayerConfig | null, LayerConfig | null] = [null, null];
  modalRef?: OverlayRef;
  onConfirmComplete?: () => void;

  private _closestPair: [[number, number], [number, number]] | null = null;
  private kdCache = new Map<string, KDTree>();
  private layerFeatureCounts = new Map<string, number>();

  protected override onActivate(): void {
    this.selectedLayers = [null, null];
    this._closestPair = null;
  }

  protected override onDeactivate(): void {
    this.selectedLayers = [null, null];
    this._closestPair = null;
    this.kdCache.clear();
    this.layerFeatureCounts.clear();

    this.tempSource?.getFeatures().forEach(f => {
      if (f.get('isTempDistanceFeature')) this.tempSource?.removeFeature(f);
    });
  }

  /** -------------------- Point Extraction -------------------- **/
  private getLayerPoints(layer: LayerConfig): [number, number][] {
    const coords: [number, number][] = [];
    const toLonLatFunc = (c: number[]) => toLonLat([c[0], c[1]]) as [number, number];

    (layer.features || [])
      .filter(f => !f.get('isTempDistanceFeature'))
      .forEach(f => {
        const geom = f.getGeometry();
        if (!geom) return;

        switch (geom.getType()) {
          case 'Point':
            coords.push(toLonLatFunc((geom as Point).getCoordinates()));
            break;
          case 'LineString':
            (geom as LineString).getCoordinates().forEach(c => coords.push(toLonLatFunc(c)));
            break;
          case 'Polygon': {
            const ringCoords = (geom as Polygon).getLinearRing(0)?.getCoordinates();
            if (ringCoords) ringCoords.forEach(c => coords.push(toLonLatFunc(c)));
            break;
          }
          case 'MultiPolygon': {
            (geom as MultiPolygon).getPolygons().forEach(p => {
              const ringCoords = p.getLinearRing(0)?.getCoordinates();
              if (ringCoords) ringCoords.forEach(c => coords.push(toLonLatFunc(c)));
            });
            break;
          }
          default:
            break;
        }
      });

    return coords;
  }

  /** -------------------- KD-Tree Management -------------------- **/
  private getKDTree(layer: LayerConfig): KDTree {
    const points = this.getLayerPoints(layer);
    const lastCount = this.layerFeatureCounts.get(layer.id) ?? -1;

    if (!this.kdCache.has(layer.id) || points.length !== lastCount) {
      this.kdCache.set(layer.id, new KDTree(points));
      this.layerFeatureCounts.set(layer.id, points.length);
    }

    return this.kdCache.get(layer.id)!;
  }

  /** -------------------- Centroid Prefiltering -------------------- **/
  private getLayerCentroids(layer: LayerConfig): [number, number][] {
    const centroids: [number, number][] = [];
    const toLonLatFunc = (c: number[]) => toLonLat([c[0], c[1]]) as [number, number];

    (layer.features || []).forEach(f => {
      const geom = f.getGeometry();
      if (!geom) return;

      if (geom instanceof Point) {
        centroids.push(toLonLatFunc(geom.getCoordinates()));
      } else if (geom instanceof LineString) {
        const coords = geom.getCoordinates();
        centroids.push(toLonLatFunc(coords[Math.floor(coords.length / 2)]));
      } else if (geom instanceof Polygon) {
        centroids.push(toLonLatFunc(geom.getInteriorPoint().getCoordinates()));
      } else if (geom instanceof MultiPolygon) {
        const firstPoly = geom.getPolygons()[0];
        if (firstPoly) centroids.push(toLonLatFunc(firstPoly.getInteriorPoint().getCoordinates()));
      }
    });

    return centroids;
  }

  /** -------------------- Distance Computation -------------------- **/
  computeDistance(layerA: LayerConfig, layerB: LayerConfig): number {
    const pointsA = this.getLayerPoints(layerA);
    const pointsB = this.getLayerPoints(layerB);
    if (!pointsA.length || !pointsB.length) return 0;

    const centroidsA = this.getLayerCentroids(layerA);
    const centroidsB = this.getLayerCentroids(layerB);

    const EARLY_EXIT_DISTANCE = 1e7; // 10,000 km
    let minCentroidDistance = Infinity;

    centroidsA.forEach(cA => {
      centroidsB.forEach(cB => {
        const dist = getLength(new LineString([cA, cB]), {
          radius: PLANETS[this.layerManager.currentPlanet].radius,
          projection: 'EPSG:4326',
        });
        if (dist < minCentroidDistance) minCentroidDistance = dist;
      });
    });

    if (minCentroidDistance > EARLY_EXIT_DISTANCE) return minCentroidDistance;

    const treeB = this.getKDTree(layerB);
    const radius = PLANETS[this.layerManager.currentPlanet].radius;
    let minDistance = Infinity;
    let closestPair: [[number, number], [number, number]] | null = null;

    for (const pA of pointsA) {
      const nearest = treeB.nearest(pA);
      if (!nearest) continue;
      const dist = getLength(new LineString([pA, nearest]), { radius, projection: 'EPSG:4326' });
      if (dist < minDistance) {
        minDistance = dist;
        closestPair = [pA, nearest];
      }
    }

    this._closestPair = closestPair;
    return minDistance === Infinity ? 0 : minDistance;
  }

  /** -------------------- Feature Drawing Helpers -------------------- **/
  private createDistanceFeature(
    geom: LineString | Point,
    featureType: 'point' | 'vertex' | 'line' | 'label',
    text?: string,
    parent?: Feature
  ): Feature {
    const f = this.createFeature(geom, featureType, text, parent, true);
    f.set('isTempDistanceFeature', true);

    if (featureType === 'line' && geom instanceof LineString) {
      geom.getCoordinates().forEach(c => {
        const vertex = this.createFeature(new Point(c), 'vertex', undefined, f, true);
        this.tempSource?.addFeature(vertex);
      });
    }

    return f;
  }

  private getMidpoint(p1: [number, number], p2: [number, number]): [number, number] {
    return [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
  }

  drawDistanceFeatures(cA: [number, number], cB: [number, number], dist: number) {
    if (!this.tempSource) return;

    this.tempSource.getFeatures().forEach(f => {
      if (f.get('isTempDistanceFeature')) this.tempSource?.removeFeature(f);
    });

    const lineFeature = this.createDistanceFeature(this.createLine([cA, cB], { alreadyProjected: false }), 'line');
    const midpoint = this.getMidpoint(cA, cB);
    const text = dist >= 1000 ? `${(dist / 1000).toFixed(2)} km` : `${dist.toFixed(1)} m`;
    const labelFeature = this.createDistanceFeature(this.createPoint(midpoint, { alreadyProjected: false }), 'label', text, lineFeature);

    this.tempSource.addFeatures([lineFeature, labelFeature]);
  }

  public async updateDistanceDisplay(): Promise<void> {
    if (!this.tempSource || !this.selectedLayers[0] || !this.selectedLayers[1]) return;

    const [lA, lB] = this.selectedLayers;
    const dist = this.computeDistance(lA, lB);
    if (!this._closestPair || dist === 0) return;

    const [cA, cB] = this._closestPair;
    this.drawDistanceFeatures(cA, cB, dist);

    await this.flyToCoordinates([cA, cB, this.getMidpoint(cA, cB)], { maxZoom: 10 });
  }

  async confirm(): Promise<void> {
    if (!this.tempSource || !this.selectedLayers[0] || !this.selectedLayers[1]) return;

    const [lA, lB] = this.selectedLayers;
    const dist = this.computeDistance(lA, lB);
    if (!this._closestPair || dist === 0) return;

    const [cA, cB] = this._closestPair;

    const lineFeature = this.createFeature(this.createLine([cA, cB], { alreadyProjected: false }), 'line');
    const midpoint = this.getMidpoint(cA, cB);
    const text = dist >= 1000 ? `${(dist / 1000).toFixed(2)} km` : `${dist.toFixed(1)} m`;
    const labelFeature = this.createFeature(this.createPoint(midpoint, { alreadyProjected: false }), 'label', text);

    this.tempSource.addFeatures([lineFeature, labelFeature]);

    const savedLayer = await this.saveAsync(`dist: ${lA.name} to ${lB.name}`);
    if (!savedLayer) console.error('Distance layer was not saved!');

    this.modalRef?.dispose();
    this.modalRef = undefined;

    await this.flyToCoordinates([cA, cB], { maxZoom: 12 }).catch(console.error);

    this.onConfirmComplete?.();
    this.deactivate();
  }
}