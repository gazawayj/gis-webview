import Draw from 'ol/interaction/Draw';
import Feature from 'ol/Feature';
import { LineString, Point } from 'ol/geom';
import { getLength } from 'ol/sphere';
import { PLANETS } from '../constants/map-constants';
import { LayerManagerService } from '../services/layer-manager.service';
import { ToolPluginBase } from './tool-base.plugin';

export class DistanceToolPlugin extends ToolPluginBase {
  name = 'distance';

  private drawInteraction?: Draw;
  private currentFeature?: Feature;
  private liveSegmentLabels: Feature[] = [];

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

    this.drawInteraction.on('drawstart', (evt: any) => {
      this.currentFeature = evt.feature as Feature;
      if (!this.currentFeature.getId()) this.currentFeature.setId(crypto.randomUUID());
      this.liveSegmentLabels = [];
    });

    this.drawInteraction.on('drawend', () => {
      if (!this.currentFeature || !this.tempSource) return;

      const geom = this.currentFeature.getGeometry() as LineString;
      const coords = geom.getCoordinates() as [number, number][];

      // Add vertices as persistent features
      coords.forEach(c => {
        const vertex = this.createFeature(
          new Point(c),
          'vertex',
          undefined,
          undefined, // independent
          false // persistent
        );
        this.tempSource?.addFeature(vertex);
      });

      // Add labels as persistent features
      this.addSegmentLabels(this.currentFeature, coords, false);

      // Clear live labels
      this.clearLiveLabels();
      this.currentFeature = undefined;
    });

    // Update live line and labels
    this.registerMapListener('pointermove', (evt: any) => {
      if (!this.currentFeature) return;
      this.updateLiveLine(this.currentFeature, evt.coordinate as [number, number]);
    });

    this.registerDomListener(window, 'keydown', (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') this.cancel();
    });
  }

  protected override onDeactivate(): void {
    this.drawInteraction = undefined;
    this.currentFeature = undefined;
    this.clearLiveLabels();
  }

  /** Add segment labels */
  private addSegmentLabels(feature: Feature, coords: [number, number][], isTemporary: boolean) {
    const planet = this.layerManager.currentPlanet;
    const radius = PLANETS[planet].radius;

    for (let i = 1; i < coords.length; i++) {
      const [c1, c2] = [coords[i - 1], coords[i]];
      const midpoint: [number, number] = [(c1[0] + c2[0]) / 2, (c1[1] + c2[1]) / 2];

      const distanceMeters = getLength(new LineString([c1, c2]), { radius });
      const text = distanceMeters >= 1000
        ? `${(distanceMeters / 1000).toFixed(2)} km`
        : `${distanceMeters.toFixed(1)} m`;

      const label = this.createFeature(
        new Point(midpoint),
        'label',
        text,
        undefined, // independent
        isTemporary
      );

      this.tempSource?.addFeature(label);
      if (isTemporary) this.liveSegmentLabels.push(label);
    }
  }

  /** Update live line while drawing */
  private updateLiveLine(feature: Feature, pointer?: [number, number]) {
    const geom = feature.getGeometry() as LineString;
    if (!geom || !this.tempSource) return;

    const coords = geom.getCoordinates() as [number, number][];
    if (!pointer || coords.length < 1) return;

    geom.setCoordinates([...coords, pointer]);
    feature.set('featureType', 'line');

    this.clearLiveLabels();
    this.addSegmentLabels(feature, coords, true);
  }

  private clearLiveLabels() {
    this.liveSegmentLabels.forEach(l => this.tempSource?.removeFeature(l));
    this.liveSegmentLabels = [];
  }
}