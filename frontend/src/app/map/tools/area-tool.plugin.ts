import Feature from 'ol/Feature';
import Polygon from 'ol/geom/Polygon';
import Point from 'ol/geom/Point';
import { getArea } from 'ol/sphere';
import Draw from 'ol/interaction/Draw';
import { PLANETS } from '../constants/map-constants';
import { LayerManagerService } from '../services/layer-manager.service';
import { ToolPluginBase } from './tool-base.plugin';

export class AreaToolPlugin extends ToolPluginBase {
  name = 'area-tool';

  private drawInteraction?: Draw;
  private currentFeature?: Feature;

  constructor(layerManager: LayerManagerService) {
    super(layerManager);
  }

  protected override onActivate(): void {
    if (!this.map || !this.tempSource) return;

    this.drawInteraction = new Draw({
      source: this.tempSource,
      type: 'Polygon',
      style: (f) => this.getFeatureStyle(f as Feature),
    });

    this.registerInteraction(this.drawInteraction);

    this.drawInteraction.on('drawstart', (evt: any) => {
      this.currentFeature = evt.feature as Feature;
    });

    // Update area label live
    this.registerMapListener('pointermove', () => {
      if (!this.currentFeature) return;
      this.updatePolygonFeature(this.currentFeature);
    });

    // ESC cancels tool
    this.registerDomListener(window, 'keydown', (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') this.cancel();
    });
  }

  protected override onDeactivate(): void {
    this.drawInteraction = undefined;
    this.currentFeature = undefined;
  }

  private updatePolygonFeature(feature: Feature): void {
    const geom = feature.getGeometry() as Polygon;
    if (!geom || !this.tempSource) return;

    const coords = geom.getCoordinates()[0];
    if (!coords.length) return;

    feature.set('featureType', 'polygon');

    // Remove old labels
    this.tempSource.getFeatures()
      .filter(f => f.get('featureType') === 'label' && f.get('parentFeature') === feature)
      .forEach(f => this.tempSource?.removeFeature(f));

    // Compute area
    const planet = this.layerManager.currentPlanet;
    const radius = PLANETS[planet].radius;
    const areaMeters = getArea(geom, { radius });

    const text = areaMeters >= 1e6
      ? `${(areaMeters / 1e6).toFixed(2)} km²`
      : `${areaMeters.toFixed(1)} m²`;

    const centroid = this.getPolygonCentroid(coords as [number, number][]);

    const labelFeature = this.createStyledFeature(
      new Point(centroid),
      'label',
      text,
      feature,
      true
    );

    this.tempSource.addFeature(labelFeature);
  }

  private getPolygonCentroid(coords: [number, number][]): [number, number] {
    const len = coords.length;
    const sum = coords.reduce((acc, c) => [acc[0] + c[0], acc[1] + c[1]], [0, 0]);
    return [sum[0] / len, sum[1] / len];
  }
}