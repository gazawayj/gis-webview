import Draw from 'ol/interaction/Draw';
import Feature from 'ol/Feature';
import { LineString } from 'ol/geom';
import { getLength } from 'ol/sphere';
import { toLonLat } from 'ol/proj';
import { PLANETS } from '../constants/map-constants';
import { LayerManagerService } from '../services/layer-manager.service';
import { ToolPluginBase } from './tool-base.plugin';

export class DistanceToolPlugin extends ToolPluginBase {
  name = 'distance';
  private drawInteraction?: Draw;
  private currentFeature?: Feature;
  private liveSegmentLabels: Feature[] = [];

  protected override onActivate(): void {
    if (!this.map || !this.tempSource) return;

    this.drawInteraction = new Draw({
      source: this.tempSource,
      type: 'LineString',
    });
    this.registerInteraction(this.drawInteraction);

    this.drawInteraction.on('drawstart', (evt: any) => {
      this.currentFeature = evt.feature as Feature;
      if (!this.currentFeature.getId()) this.currentFeature.setId(crypto.randomUUID());
      this.currentFeature.set('featureType', 'line');
    });

    this.drawInteraction.on('drawend', () => {
      if (!this.currentFeature) return;

      const geom = this.currentFeature.getGeometry() as LineString;
      const mapCoords = geom.getCoordinates() as [number, number][];

      // 1. Clean up live labels before final placement
      this.clearLiveLabels();

      const lonLatCoords = mapCoords.map(c => toLonLat(c) as [number, number]);

      // 2. Add permanent labels (isDrawing = false)
      this.addSegmentLabels(lonLatCoords, false, this.currentFeature);

      // 3. Add permanent vertices using base tools
      lonLatCoords.forEach(c => {
        const vertex = this.createFeature(this.createPoint(c), 'vertex', undefined, this.currentFeature, false);
        this.tempSource?.addFeature(vertex);
      });

      this.currentFeature = undefined;
    });

    this.registerMapListener('pointermove', () => {
      if (!this.currentFeature) return;

      const geom = this.currentFeature.getGeometry() as LineString;
      const mapCoords = geom.getCoordinates() as [number, number][];

      this.clearLiveLabels();

      // Only draw labels if we have more than just the mouse pointer coordinate
      if (mapCoords.length > 1) {
        const lonLatCoords = mapCoords.map(c => toLonLat(c) as [number, number]);
        this.addSegmentLabels(lonLatCoords, true, this.currentFeature);
      }
    });
  }

  private addSegmentLabels(lonLatCoords: [number, number][], isDrawing: boolean, parentFeature: Feature) {
    const planet = this.layerManager.currentPlanet;
    const radius = PLANETS[planet].radius;

    const limit = isDrawing ? lonLatCoords.length - 1 : lonLatCoords.length;

    for (let i = 1; i < limit; i++) {
      const [p1, p2] = [lonLatCoords[i - 1], lonLatCoords[i]];

      const lineGeom = new LineString([p1, p2]);
      const dist = getLength(lineGeom, { radius, projection: 'EPSG:4326' });

      if (dist === 0) continue; // <-- SKIP zero-length segments

      const text = dist >= 1000 ? `${(dist / 1000).toFixed(2)} km` : `${dist.toFixed(1)} m`;
      const midpoint: [number, number] = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];

      const label = this.createFeature(this.createPoint(midpoint), 'label', text, parentFeature, false);
      this.tempSource?.addFeature(label);
      if (isDrawing) this.liveSegmentLabels.push(label);
    }
  }

  private clearLiveLabels() {
    this.liveSegmentLabels.forEach(l => this.tempSource?.removeFeature(l));
    this.liveSegmentLabels = [];
  }

  protected override onDeactivate(): void {
    this.drawInteraction = undefined;
    this.currentFeature = undefined;
    this.clearLiveLabels();
  }
}
