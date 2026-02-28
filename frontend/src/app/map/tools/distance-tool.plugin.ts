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

    // Draw interaction
    this.drawInteraction = new Draw({
      source: this.tempSource,
      type: 'LineString',
      style: (f) => this.getFeatureStyle(f as Feature),
    });

    this.registerInteraction(this.drawInteraction);

    // DRAW START
    this.drawInteraction.on('drawstart', (evt: any) => {
      this.currentFeature = evt.feature as Feature;
      this.currentFeature.set('isToolFeature', true);

      if (!this.currentFeature.getId()) {
        this.currentFeature.setId(crypto.randomUUID());
      }

      this.liveSegmentLabels = [];
    });

    // DRAW END (double-click finishes)
    this.drawInteraction.on('drawend', () => {
      if (!this.currentFeature || !this.tempSource) return;

      const geom = this.currentFeature.getGeometry() as LineString;
      const coords = geom.getCoordinates() as [number, number][];

      // Add vertices
      coords.forEach(c => {
        const vertex = this.createStyledFeature(
          new Point(c),
          'vertex',
          undefined,
          this.currentFeature,
          true
        );
        this.tempSource?.addFeature(vertex);
      });

      // Add final segment labels
      this.addFinalSegmentLabels(this.currentFeature, coords);

      // Remove live labels
      this.clearLiveLabels();

      this.currentFeature = undefined;
    });

    // POINTER MOVE — update live segment
    this.registerMapListener('pointermove', (evt: any) => {
      if (!this.currentFeature) return;
      this.updateLiveLine(this.currentFeature, evt.coordinate as [number, number]);
    });

    // ESC cancels drawing only
    this.registerDomListener(window, 'keydown', (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') this.cancel();
    });
  }

  protected override onDeactivate(): void {
    this.drawInteraction = undefined;
    this.currentFeature = undefined;
    this.clearLiveLabels();
  }

  // FINAL LABELS
  private addFinalSegmentLabels(feature: Feature, coords: [number, number][]) {
    const planet = this.layerManager.currentPlanet;
    const radius = PLANETS[planet].radius;

    for (let i = 1; i < coords.length; i++) {
      const [c1, c2] = [coords[i - 1], coords[i]];
      const midpoint: [number, number] = [
        (c1[0] + c2[0]) / 2,
        (c1[1] + c2[1]) / 2
      ];

      const distanceMeters = getLength(
        new LineString([c1, c2]),
        { radius }
      );

      const text =
        distanceMeters >= 1000
          ? `${(distanceMeters / 1000).toFixed(2)} km`
          : `${distanceMeters.toFixed(1)} m`;

      const label = this.createStyledFeature(
        new Point(midpoint),
        'label',
        text,
        feature,
        true
      );

      this.tempSource?.addFeature(label);
    }
  }

  // LIVE LABELS
  private updateLiveLine(feature: Feature, pointer?: [number, number]) {
    const geom = feature.getGeometry() as LineString;
    if (!geom || !this.tempSource) return;

    const coords = geom.getCoordinates() as [number, number][];
    const displayCoords = pointer ? [...coords, pointer] : coords;

    geom.setCoordinates(displayCoords);
    feature.set('featureType', 'line');

    this.clearLiveLabels();

    if (coords.length < 2 || !pointer) return;

    const planet = this.layerManager.currentPlanet;
    const radius = PLANETS[planet].radius;

    for (let i = 1; i < coords.length; i++) {
      const [c1, c2] = [coords[i - 1], coords[i]];
      const midpoint: [number, number] = [
        (c1[0] + c2[0]) / 2,
        (c1[1] + c2[1]) / 2
      ];

      const distanceMeters = getLength(
        new LineString([c1, c2]),
        { radius }
      );

      const text =
        distanceMeters >= 1000
          ? `${(distanceMeters / 1000).toFixed(2)} km`
          : `${distanceMeters.toFixed(1)} m`;

      const label = this.createStyledFeature(
        new Point(midpoint),
        'label',
        text,
        feature,
        true
      );

      this.tempSource.addFeature(label);
      this.liveSegmentLabels.push(label);
    }
  }

  private clearLiveLabels() {
    this.liveSegmentLabels.forEach(l => this.tempSource?.removeFeature(l));
    this.liveSegmentLabels = [];
  }
}