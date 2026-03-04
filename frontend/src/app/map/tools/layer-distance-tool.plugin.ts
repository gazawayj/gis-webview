import Feature from 'ol/Feature';
import { LineString, MultiPolygon, Point, Polygon } from 'ol/geom';
import { getLength } from 'ol/sphere';
import { PLANETS } from '../constants/map-constants';
import { ToolPluginBase } from './tool-base.plugin';
import { LayerConfig } from '../models/layer-config.model';
import { OverlayRef } from '@angular/cdk/overlay';
import { toLonLat } from 'ol/proj';

/** Lightweight KD-tree for 2D points */
class KDNode {
    point: [number, number];
    left: KDNode | null = null;
    right: KDNode | null = null;
    axis: 0 | 1;
    constructor(point: [number, number], axis: 0 | 1) {
        this.point = point;
        this.axis = axis;
    }
}

class KDTree {
    root: KDNode | null;
    constructor(points: [number, number][]) { this.root = this.build(points, 0); }
    private build(points: [number, number][], depth: number): KDNode | null {
        if (!points.length) return null;
        const axis: 0 | 1 = depth % 2 as 0 | 1;
        points.sort((a, b) => a[axis] - b[axis]);
        const mid = Math.floor(points.length / 2);
        const node = new KDNode(points[mid], axis);
        node.left = this.build(points.slice(0, mid), depth + 1);
        node.right = this.build(points.slice(mid + 1), depth + 1);
        return node;
    }
    nearest(point: [number, number]): [number, number] | null {
        let best: [number, number] | null = null;
        let bestDist = Infinity;
        const distance = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
        const search = (node: KDNode | null) => {
            if (!node) return;
            const d = distance(point, node.point);
            if (d < bestDist && d > 0) { bestDist = d; best = node.point; }
            const axis = node.axis;
            const diff = point[axis] - node.point[axis];
            const first = diff <= 0 ? node.left : node.right;
            const second = diff <= 0 ? node.right : node.left;
            search(first);
            if (Math.abs(diff) < bestDist) search(second);
        };
        search(this.root);
        return best;
    }
}

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
    }

    private createDistanceFeature(
        geom: any,
        featureType: 'point' | 'vertex' | 'pointerVertex' | 'line' | 'label' | 'polygon',
        text?: string,
        parent?: Feature
    ): Feature {
        const f = this.createFeature(geom, featureType, text, parent, true, true);
        f.set('isTempDistanceFeature', true);
        return f;
    }

    /**
     * Helper to get coordinates in Lon/Lat (EPSG:4326) 
     * This ensures KDTree search and getLength math are consistent.
     */
    private getLayerPoints(layer: LayerConfig): [number, number][] {
        const coords: [number, number][] = [];
        const toLonLatFunc = (c: any) => toLonLat(c) as [number, number];

        (layer.features || [])
            .filter(f => !f.get('isTempDistanceFeature'))
            .forEach(f => {
                const geom = f.getGeometry();
                if (!geom) return;
                const type = geom.getType();
                
                if (type === 'Point') coords.push(toLonLatFunc((geom as Point).getCoordinates()));
                else if (type === 'LineString') coords.push(...(geom as LineString).getCoordinates().map(toLonLatFunc));
                else if (type === 'Polygon') (geom as Polygon).getCoordinates().forEach(ring => coords.push(...ring.map(toLonLatFunc)));
                else if (type === 'MultiPolygon') (geom as MultiPolygon).getCoordinates().forEach(p => p.forEach(r => coords.push(...r.map(toLonLatFunc))));
            });
        return coords;
    }

    private getKDTree(layer: LayerConfig): KDTree {
        const points = this.getLayerPoints(layer);
        const lastCount = this.layerFeatureCounts.get(layer.id) ?? -1;
        if (!this.kdCache.has(layer.id) || points.length !== lastCount) {
            this.kdCache.set(layer.id, new KDTree(points));
            this.layerFeatureCounts.set(layer.id, points.length);
        }
        return this.kdCache.get(layer.id)!;
    }

    computeDistance(layerA: LayerConfig, layerB: LayerConfig): number {
        const pointsA = this.getLayerPoints(layerA);
        const pointsB = this.getLayerPoints(layerB);
        if (!pointsA.length || !pointsB.length) return 0;

        const treeB = this.getKDTree(layerB);
        const planetKey = this.layerManager.currentPlanet;
        const radius = PLANETS[planetKey].radius;

        let minDistance = Infinity;
        let closestPair: [[number, number], [number, number]] | null = null;

        for (const pA of pointsA) {
            const nearest = treeB.nearest(pA);
            if (!nearest) continue;

            // These are already in Lon/Lat degrees
            const line = new LineString([pA, nearest]);
            const dist = getLength(line, { radius, projection: 'EPSG:4326' });

            if (dist < minDistance) {
                minDistance = dist;
                closestPair = [pA, nearest];
            }
        }
        this._closestPair = closestPair;
        return minDistance === Infinity ? 0 : minDistance;
    }

    async confirm(): Promise<void> {
        if (!this.tempSource || !this.selectedLayers[0] || !this.selectedLayers[1]) return;
        const [lA, lB] = this.selectedLayers;
        const dist = this.computeDistance(lA, lB);
        if (!this._closestPair || dist === 0) return;

        const [cA, cB] = this._closestPair; // These are LonLat
        
        // Base tool helpers 'createLine' and 'createPoint' perform fromLonLat()
        // Pass them LonLat coordinates so they project exactly once.
        const lineFeature = this.createDistanceFeature(this.createLine([cA, cB]), 'line');
        
        const midpoint: [number, number] = [(cA[0] + cB[0]) / 2, (cA[1] + cB[1]) / 2];
        const text = dist >= 1000 ? `${(dist / 1000).toFixed(2)} km` : `${dist.toFixed(1)} m`;
        
        const labelFeature = this.createDistanceFeature(this.createPoint(midpoint), 'label', text, lineFeature);

        this.tempSource.addFeatures([lineFeature, labelFeature]);
        
        // flyToCoordinates also performs fromLonLat()
        await this.flyToCoordinates([cA, cB, midpoint], { maxZoom: 12 });
        
        await this.saveAsync(`dist: ${lA.name} to ${lB.name}`);
        
        this.onConfirmComplete?.();
        this.deactivate();
    }
}
