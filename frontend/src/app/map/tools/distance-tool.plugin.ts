import Draw from 'ol/interaction/Draw';
import Feature from 'ol/Feature';
import { LineString, Point } from 'ol/geom';
import { toLonLat } from 'ol/proj';
import { getLength } from 'ol/sphere';
import { PLANETS } from '../constants/map-constants';
import { LayerManagerService } from '../services/layer-manager.service';
import { ToolPluginBase } from './tool-base.plugin';

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

    // Initialize Draw interaction
    this.drawInteraction = new Draw({
      source: this.tempSource,
      type: 'LineString',
    });
    this.registerInteraction(this.drawInteraction);

    // Start drawing
    this.drawInteraction.on('drawstart', (evt: any) => {
      this.currentFeature = evt.feature as Feature;
      if (!this.currentFeature.getId()) this.currentFeature.setId(crypto.randomUUID());
      this.liveSegmentLabels = [];
      this.vertices = [];
    });

    // Finish line on double click
    this.drawInteraction.on('drawend', () => {
      if (!this.currentFeature || !this.tempSource) return;

      const geom = this.currentFeature.getGeometry() as LineString;
      const coords = geom.getCoordinates() as [number, number][];
      if (coords.length < 2) {
        this.tempSource.removeFeature(this.currentFeature);
        this.currentFeature = undefined;
        return;
      }

      this.currentFeature.set('featureType', 'line');
      this.currentFeature.set('isDistance', true);

      // Add vertices as independent points
      coords.forEach(c => {
        const vertex = this.createFeature(
          new Point(c),
          'vertex',
          undefined,          // no text/label
          this.currentFeature, 
          true                // mark as tool feature so they are saved
        );
        this.tempSource?.addFeature(vertex);
        this.vertices.push(vertex);
      });

      // Add persistent segment labels
      this.addSegmentLabels(coords, false, this.currentFeature);

      this.clearLiveLabels();
      this.currentFeature = undefined;
    });

    // Update live rubber-band line on mouse move
    this.registerMapListener('pointermove', (evt: any) => {
      if (!this.currentFeature) return;
      this.updateLiveLine(this.currentFeature, evt.coordinate as [number, number]);
    });

    // Right click: just open save modal, don't finalize line
    this.registerDomListener(this.map.getViewport(), 'contextmenu', (evt: MouseEvent) => evt.preventDefault());

    // Escape cancels
    this.registerDomListener(window, 'keydown', (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') this.cancel();
    });
  }

  private updateLiveLine(feature: Feature, pointer: [number, number]) {
    const geom = feature.getGeometry() as LineString;
    const coords = geom.getCoordinates();
    const lastCoords = coords.slice(0, coords.length - 1);
    geom.setCoordinates([...lastCoords, pointer]);
    feature.changed();

    this.clearLiveLabels();

    // Draw last segment label (distance)
    if (coords.length > 0) {
      const p1 = coords[coords.length - 1];
      const p2 = pointer;
      const [lon1, lat1] = toLonLat(p1);
      const [lon2, lat2] = toLonLat(p2);
      const dist = getLength(new LineString([[lon1, lat1], [lon2, lat2]]), {
        radius: PLANETS[this.layerManager.currentPlanet].radius,
        projection: 'EPSG:4326',
      });
      const text = dist >= 1000 ? `${(dist / 1000).toFixed(2)} km` : `${dist.toFixed(1)} m`;
      const midpoint: [number, number] = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];

      const label = this.createFeature(new Point(midpoint), 'label', text, feature, true);
      this.tempSource?.addFeature(label);
      this.liveSegmentLabels.push(label);
    }
  }

  private addSegmentLabels(coords: [number, number][], isLive: boolean, parent: Feature) {
    for (let i = 1; i < coords.length; i++) {
      const [p1, p2] = [coords[i - 1], coords[i]];
      const [lon1, lat1] = toLonLat(p1);
      const [lon2, lat2] = toLonLat(p2);
      const dist = getLength(new LineString([[lon1, lat1], [lon2, lat2]]), {
        radius: PLANETS[this.layerManager.currentPlanet].radius,
        projection: 'EPSG:4326',
      });
      const text = dist >= 1000 ? `${(dist / 1000).toFixed(2)} km` : `${dist.toFixed(1)} m`;
      const midpoint: [number, number] = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];

      const label = this.createFeature(new Point(midpoint), 'label', text, parent, true);
      this.tempSource?.addFeature(label);
      if (isLive) this.liveSegmentLabels.push(label);
    }
  }

  private clearLiveLabels() {
    this.liveSegmentLabels.forEach(l => this.tempSource?.removeFeature(l));
    this.liveSegmentLabels = [];
  }

  public override save(name: string): any {
    const newLayer = super.save(name);
    if (newLayer) this.deactivate();
    return newLayer;
  }

  protected override onDeactivate(): void {
    if (this.currentFeature && this.tempSource) this.tempSource.removeFeature(this.currentFeature);
    this.currentFeature = undefined;

    this.vertices.forEach(v => this.tempSource?.removeFeature(v));
    this.vertices = [];

    this.clearLiveLabels();
  }
}