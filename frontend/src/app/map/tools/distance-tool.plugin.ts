import Draw from 'ol/interaction/Draw';
import Feature from 'ol/Feature';
import { LineString, Point } from 'ol/geom';
import { toLonLat } from 'ol/proj';
import { getLength } from 'ol/sphere';
import { PLANETS } from '../constants/map-constants';
import { LayerManagerService } from '../services/layer-manager.service';
import { ToolPluginBase } from './tool-base.plugin';
import { error } from 'console';

export class DistanceToolPlugin extends ToolPluginBase {
  name = 'distance';

  private drawInteraction?: Draw;
  private currentFeature?: Feature;
  private liveSegmentLabels: Feature[] = [];
  private vertices: Feature[] = [];

  constructor(layerManager: LayerManagerService) {
    super(layerManager);
  }

  protected override onActivate(): void {
    if (!this.map || !this.tempSource) return;

    this.drawInteraction = new Draw({
      source: this.tempSource,
      stopClick: true,
      type: 'LineString'
    });

    this.registerInteraction(this.drawInteraction);

    this.drawInteraction.on('drawstart', (evt: any) => {
      this.currentFeature = evt.feature as Feature;

      if (!this.currentFeature.getId()) this.currentFeature.setId(crypto.randomUUID());
      this.currentFeature.set('featureType', 'line');
      this.currentFeature.set('isToolFeature', true);

      this.liveSegmentLabels = [];
      this.vertices = [];
    });

    this.registerMapListener('dblclick', (evt: any) => {
      if (!this.currentFeature) return;
      this.drawInteraction?.finishDrawing();
      evt.preventDefault();
    });

    this.drawInteraction.on('drawend', () => {
      if (!this.currentFeature) return;

      this.clearLiveLabels();

      const geom = this.currentFeature.getGeometry() as LineString;
      const coords = geom.getCoordinates() as [number, number][];

      this.currentFeature.set('featureType', 'line');
      this.currentFeature.set('isToolFeature', true);

      coords.forEach(c => {
        const vertex = this.createFeature(new Point(c), 'vertex', undefined, this.currentFeature, true);
        this.tempSource?.addFeature(vertex);
      });

      this.addSegmentLabels(coords, false, this.currentFeature);
      this.currentFeature = undefined;
    });

    this.registerMapListener('pointermove', (evt: any) => {
      if (this.currentFeature) this.updateLiveLabels(evt.coordinate as [number, number]);
    });

    this.registerDomListener(this.map.getViewport(), 'contextmenu', (evt: MouseEvent) => evt.preventDefault());
    this.registerDomListener(window, 'keydown', (evt: KeyboardEvent) => { if (evt.key === 'Escape') this.cancel(); });
  }

  private updateLiveLabels(pointer: [number, number]) {
    if (!this.currentFeature || !this.tempSource) return;

    const geom = this.currentFeature.getGeometry() as LineString;
    const coords = geom.getCoordinates();

    this.clearLiveLabels();

    if (coords.length > 1) {
      const p1 = coords[coords.length - 2];
      const p2 = pointer;
      const [lon1, lat1] = toLonLat(p1);
      const [lon2, lat2] = toLonLat(p2);

      const dist = getLength(new LineString([[lon1, lat1], [lon2, lat2]]), {
        radius: PLANETS[this.layerManager.currentPlanet].radius,
        projection: 'EPSG:4326'
      });

      if (dist <= 0) return;

      const text = dist >= 1000 ? `${(dist / 1000).toFixed(2)} km` : `${dist.toFixed(1)} m`;
      const midpoint: [number, number] = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];

      const label = this.createFeature(new Point(midpoint), 'label', text, this.currentFeature, false);
      this.tempSource.addFeature(label);
      this.liveSegmentLabels.push(label);
    }
  }

  private addSegmentLabels(coords: [number, number][], isLive: boolean, parent: Feature) {
    if (!this.tempSource) return;

    for (let i = 1; i < coords.length; i++) {
      const [p1, p2] = [coords[i - 1], coords[i]];
      const [lon1, lat1] = toLonLat(p1);
      const [lon2, lat2] = toLonLat(p2);

      const dist = getLength(new LineString([[lon1, lat1], [lon2, lat2]]), {
        radius: PLANETS[this.layerManager.currentPlanet].radius,
        projection: 'EPSG:4326'
      });

      if (dist <= 0) continue;

      const text = dist >= 1000 ? `${(dist / 1000).toFixed(2)} km` : `${dist.toFixed(1)} m`;
      const midpoint: [number, number] = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];

      const label = this.createFeature(new Point(midpoint), 'label', text, parent, true);
      this.tempSource.addFeature(label);

      if (isLive) this.liveSegmentLabels.push(label);
    }
  }

  private clearLiveLabels() {
    this.liveSegmentLabels.forEach(l => { try { this.tempSource?.removeFeature(l); } catch { (error)} });
    this.liveSegmentLabels = [];
  }
}