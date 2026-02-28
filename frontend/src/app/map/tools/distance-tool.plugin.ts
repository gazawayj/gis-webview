import Draw from 'ol/interaction/Draw';
import Feature from 'ol/Feature';
import { LineString, Point } from 'ol/geom';
import { getLength } from 'ol/sphere';
import { PLANETS } from '../constants/map-constants';
import { LayerManagerService } from '../services/layer-manager.service';
import { ToolPluginBase } from './tool-base.plugin';
import { LayerConfig } from '../models/layer-config.model';

export class DistanceToolPlugin extends ToolPluginBase {
  name = 'distance';

  private drawInteraction?: Draw;
  private currentFeature?: Feature;
  private liveSegmentLabels: Feature[] = [];
  private vertexCoords: [number, number][] = [];

  constructor(layerManager: LayerManagerService) {
    super(layerManager);
  }

  protected override onActivate(): void {
    if (!this.map || !this.tempSource) return;

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
      this.vertexCoords = [];
    });

    // Finish drawing
    this.drawInteraction.on('drawend', () => {
      if (!this.currentFeature) return;

      const geom = this.currentFeature.getGeometry() as LineString;
      const coords = geom.getCoordinates() as [number, number][];
      this.currentFeature.set('featureType', 'line');
      this.currentFeature.set('isDistance', true);

      // Save final coordinates for vertices
      this.vertexCoords = coords;

      // Add labels to midpoints
      this.addSegmentLabels(coords, false, this.currentFeature);

      // Add vertices to tempSource immediately
      coords.forEach(c => {
        const vertex = this.createFeature(new Point(c), 'vertex', undefined, this.currentFeature, false);
        this.tempSource?.addFeature(vertex);
      });

      this.clearLiveLabels();
      this.currentFeature = undefined;
    });

    // Live pointer update
    this.registerMapListener('pointermove', (evt: any) => {
      if (!this.currentFeature) return;
      this.updateLiveLine(this.currentFeature, evt.coordinate as [number, number]);
    });

    // ESC cancels
    this.registerDomListener(window, 'keydown', (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') this.cancel();
    });
  }

  protected override onDeactivate(): void {
    this.drawInteraction = undefined;
    this.currentFeature = undefined;
    this.clearLiveLabels();
  }

  /** Add distance labels between vertices */
  private addSegmentLabels(coords: [number, number][], isTemporary: boolean, parentFeature?: Feature) {
    const planet = this.layerManager.currentPlanet;
    const radius = PLANETS[planet].radius;

    for (let i = 1; i < coords.length; i++) {
      const [c1, c2] = [coords[i - 1], coords[i]];
      const midpoint: [number, number] = [(c1[0] + c2[0]) / 2, (c1[1] + c2[1]) / 2];

      const distanceMeters = getLength(new LineString([c1, c2]), { radius });
      const text = distanceMeters >= 1000
        ? `${(distanceMeters / 1000).toFixed(2)} km`
        : `${distanceMeters.toFixed(1)} m`;

      const label = this.createFeature(new Point(midpoint), 'label', text, parentFeature, isTemporary);

      if (isTemporary) this.liveSegmentLabels.push(label);
      else this.tempSource?.addFeature(label);
    }
  }

  /** Update live line during drawing */
  private updateLiveLine(feature: Feature, pointer?: [number, number]) {
    if (!pointer) return;

    const geom = feature.getGeometry() as LineString;
    if (!geom) return;

    const coords = geom.getCoordinates() as [number, number][];
    geom.setCoordinates([...coords.slice(0, coords.length - 1), pointer]); // last coordinate is live pointer
    feature.set('featureType', 'line');

    // Update vertices while drawing
    this.vertexCoords = coords;

    this.clearLiveLabels();
    if (coords.length >= 1) this.addSegmentLabels(coords, true, feature);
  }

  /** Clear temporary live labels */
  private clearLiveLabels() {
    this.liveSegmentLabels.forEach(l => this.tempSource?.removeFeature(l));
    this.liveSegmentLabels = [];
  }

  /** Save the drawn line + vertices without cloning */
  protected override onSave(layer: LayerConfig) {
    if (!this.tempSource) return;

    // Only save distance lines
    const lineFeatures = this.tempSource.getFeatures().filter(f => f.get('isDistance') === true) as Feature[];
    if (!lineFeatures.length) return;

    lineFeatures.forEach(line => {
      // Add main line
      layer.features?.push(line);

      // Add vertices
      const coords = (line.getGeometry() as LineString).getCoordinates() as [number, number][];
      coords.forEach(c => {
        const vertex = this.createFeature(new Point(c), 'vertex', undefined, line, false);
        layer.features?.push(vertex);
      });
    });
  }
}