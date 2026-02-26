import Draw from 'ol/interaction/Draw';
import Feature from 'ol/Feature';
import { LineString, Point } from 'ol/geom';
import { getLength } from 'ol/sphere';

import { PLANETS } from '../constants/map-constants';
import { LayerManagerService } from '../services/layer-manager.service';
import { ToolPluginBase } from './tool-base.plugin';
import Snap from 'ol/interaction/Snap';

export class DistanceToolPlugin extends ToolPluginBase {
  name = 'distance';

  private drawInteraction?: Draw;
  private currentFeature?: Feature;
  private snapInteraction?: Snap;

  constructor(layerManager: LayerManagerService) {
    super(layerManager);
  }

  /* =========================
     ToolPluginBase hooks
     ========================= */

  protected override onActivate(): void {
    if (!this.map || !this.tempSource) return;

    /* ---------- Draw interaction ---------- */
    this.drawInteraction = new Draw({
      source: this.tempSource,
      type: 'LineString',
      style: (f) => this.getStyle!(f),
    });
    this.registerInteraction(this.drawInteraction);

    this.drawInteraction.on('drawstart', (evt: any) => {
      const feature = evt.feature;
      feature.set('verticesAdded', false);
      this.currentFeature = feature;
    });

    /* ---------- Pointer move ---------- */
    this.registerMapListener('pointermove', (evt: any) => {
      if (!this.currentFeature) return;
      this.updateVerticesAndLabels(this.currentFeature, evt.coordinate);
    });

    /* ---------- Right-click finish ---------- */
    this.registerDomListener(
      this.map.getTargetElement(),
      'contextmenu',
      (evt: MouseEvent) => {
        evt.preventDefault();

        this.drawInteraction?.finishDrawing();

        this.map
          ?.getTargetElement()
          .dispatchEvent(
            new CustomEvent('plugin-save-request', { bubbles: true })
          );
      }
    );

    /* ---------- ESC cancels tool ---------- */
    this.registerDomListener(window, 'keydown', (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') this.cancel();
    });
  }

  protected override onDeactivate(): void {
    this.drawInteraction = undefined;
    this.currentFeature = undefined;
    this.snapInteraction = undefined;
  }

  protected override onSave(layer: any): void {
    // Tag as distance layer so symbol/color selectors recognize it
    layer.isDistanceLayer = true;
  }

  /* =========================
     Measurement logic
     ========================= */

  private updateVerticesAndLabels(feature: Feature, pointer?: [number, number]): void {
    const geom = feature.getGeometry() as LineString;
    if (!geom || !this.tempSource) return;

    // Remove dynamic features: labels & pointer
    this.tempSource
      .getFeatures()
      .filter((f) => f.get('featureType') === 'label' || f.get('featureType') === 'pointerVertex')
      .forEach((f) => this.tempSource?.removeFeature(f));

    const coords = geom.getCoordinates() as [number, number][];
    if (!coords.length) return;

    feature.set('featureType', 'line');

    // Permanent vertices
    if (!feature.get('verticesAdded')) {
      coords.forEach((c) => {
        const vertex = new Feature(new Point(c));
        vertex.set('featureType', 'vertex');
        this.tempSource?.addFeature(vertex);
      });
      feature.set('verticesAdded', true);
    }

    // Pointer vertex
    if (pointer) {
      const pv = new Feature(new Point(pointer));
      pv.set('featureType', 'pointerVertex');
      this.tempSource.addFeature(pv);
    }

    // Segment labels
    for (let i = 1; i < coords.length; i++) {
      const c1 = coords[i - 1];
      const c2 = coords[i];
      const midpoint: [number, number] = [
        (c1[0] + c2[0]) / 2,
        (c1[1] + c2[1]) / 2,
      ];

      const distanceMeters = getLength(new LineString([c1, c2]), {
        radius: PLANETS[this.planet].radius,
      });

      const text =
        distanceMeters >= 1000
          ? `${(distanceMeters / 1000).toFixed(2)} km`
          : `${distanceMeters.toFixed(1)} m`;

      const label = new Feature(new Point(midpoint));
      label.set('featureType', 'label');
      label.set('text', text);
      this.tempSource.addFeature(label);
    }
  }
}