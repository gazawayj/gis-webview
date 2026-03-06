import Feature from 'ol/Feature';
import { Polygon, Point } from 'ol/geom';
import { getArea } from 'ol/sphere';
import Draw from 'ol/interaction/Draw';
import { PLANETS } from '../constants/map-constants';
import { LayerManagerService } from '../services/layer-manager.service';
import { ToolPluginBase } from './tool-base.plugin';
import VectorSource from 'ol/source/Vector';

export class AreaToolPlugin extends ToolPluginBase {
  name = 'area-tool';

  private drawInteraction?: Draw;
  private currentFeature?: Feature;

  constructor(layerManager: LayerManagerService) {
    super(layerManager);
  }

  protected override onActivate(): void {
    if (!this.map || !this.tempSource) return;
    this.drawInteraction = new Draw({ source: this.tempSource, type: 'Polygon' });
    this.registerInteraction(this.drawInteraction);

    this.drawInteraction.on('drawstart', (evt: any) => {
      this.currentFeature = evt.feature as Feature;
      this.currentFeature.set('featureType', 'polygon');
      this.currentFeature.set('isToolFeature', true);
    });

    this.drawInteraction.on('drawend', () => {
      if (!this.currentFeature) return;

      const geom = this.currentFeature.getGeometry() as Polygon;
      const coords = geom.getCoordinates();
      const outerRing = coords[0] as [number, number][];

      // Calculate final area
      const planet = this.layerManager.currentPlanet;
      const radius = PLANETS[planet].radius;
      const areaMeters = getArea(geom, { radius, projection: this.map?.getView().getProjection() });
      const text = areaMeters >= 1e6 ? `${(areaMeters / 1e6).toFixed(2)} km²` : `${areaMeters.toFixed(1)} m²`;

      // Add vertices
      outerRing.forEach(c => {
        const vertex = this.createFeature(new Point(c), 'vertex', undefined, this.currentFeature, true);
        this.tempSource?.addFeature(vertex);
      });

      // Create the permanent label (isToolFeature = true)
      const centroid = this.getPolygonCentroid(outerRing);
      const finalLabel = this.createFeature(new Point(centroid), 'label', text, this.currentFeature, true);
      this.tempSource?.addFeature(finalLabel);

      this.currentFeature = undefined;
    });

    this.registerMapListener('pointermove', () => {
      if (this.currentFeature) this.updatePolygonFeature(this.currentFeature);
    });

    this.registerDomListener(window, 'keydown', (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') this.cancel();
    });
  }

  protected override onDeactivate(): void {
    if (this.drawInteraction) {
      this.drawInteraction.abortDrawing();
      const overlaySource = this.drawInteraction.getOverlay().getSource() as VectorSource;
      if (overlaySource) overlaySource.clear();
      this.drawInteraction.setActive(false);
      this.map?.removeInteraction(this.drawInteraction);
    }
    if (this.tempSource) this.tempSource.clear();
    this.drawInteraction = undefined;
    this.currentFeature = undefined;
  }

  private updatePolygonFeature(feature: Feature): void {
    const geom = feature.getGeometry() as Polygon;
    if (!geom) return;
    const coords = geom.getCoordinates();
    if (!coords || !coords.length) return;

    // Remove old TEMP labels
    this.tempSource?.getFeatures()
      .filter(f => f.get('featureType') === 'label' && f.get('parentFeature') === feature)
      .forEach(f => this.tempSource?.removeFeature(f));

    const planet = this.layerManager.currentPlanet;
    const areaMeters = getArea(geom, {
      radius: PLANETS[planet].radius,
      projection: this.map?.getView().getProjection()
    });
    const text = areaMeters >= 1e6 ? `${(areaMeters / 1e6).toFixed(2)} km²` : `${areaMeters.toFixed(1)} m²`;
    const centroid = this.getPolygonCentroid(coords[0] as [number, number][]);

    // isToolFeature is FALSE here so live-moving labels don't get saved if user hits save mid-draw
    const labelFeature = this.createFeature(new Point(centroid), 'label', text, feature, false);
    this.tempSource?.addFeature(labelFeature);
  }

  private getPolygonCentroid(coords: [number, number][]): [number, number] {
    if (!coords.length) return [0, 0];
    const sum = coords.reduce((acc, c) => [acc[0] + c[0], acc[1] + c[1]], [0, 0]);
    return [sum[0] / coords.length, sum[1] / coords.length];
  }
}