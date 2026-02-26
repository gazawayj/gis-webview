import Draw from 'ol/interaction/Draw';
import Feature from 'ol/Feature';
import { Polygon, Point } from 'ol/geom';
import { getArea } from 'ol/sphere';
import Snap from 'ol/interaction/Snap';
import { Stroke, Fill, Style } from 'ol/style';

import { PLANETS } from '../constants/map-constants';
import { LayerManagerService } from '../services/layer-manager.service';
import { ToolPluginBase } from './tool-base.plugin';
import { ShapeType } from '../constants/symbol-constants';

export class AreaToolPlugin extends ToolPluginBase {
  name = 'area';

  private drawInteraction?: Draw;
  private currentPolygon?: Feature;
  private snapInteraction?: Snap;

  constructor(layerManager: LayerManagerService) {
    super(layerManager);

    // Ensure tempShape is valid for vertex styling
    if (!this.tempShape || this.tempShape === 'line') {
      this.tempShape = this.layerManager.styleService.getRandomShape();
    }
  }

  /* =========================
     ToolPluginBase hooks
     ========================= */
  protected override onActivate(): void {
    if (!this.map || !this.tempSource) return;

    // Draw interaction
    this.drawInteraction = new Draw({
      source: this.tempSource,
      type: 'Polygon',
      style: (f) => this.getStyle!(f),
    });
    this.registerInteraction(this.drawInteraction);

    this.drawInteraction.on('drawstart', (evt: any) => {
      const feature = evt.feature;
      feature.set('verticesAdded', false);
      this.currentPolygon = feature;
    });

    // Pointer move updates temporary polygon & dynamic label
    this.registerMapListener('pointermove', (evt: any) => {
      if (!this.currentPolygon) return;
      const pointer = evt.coordinate as [number, number];
      this.updatePolygonFeature(this.currentPolygon, pointer);
    });

    // Right-click finishes drawing and triggers save modal
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

    // ESC cancels tool
    this.registerDomListener(window, 'keydown', (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') this.cancel();
    });
  }

  protected override onDeactivate(): void {
    this.drawInteraction = undefined;
    this.currentPolygon = undefined;
    this.snapInteraction = undefined;
  }

  // Tag the layer on save
  protected override onSave(layer: any): void {
    layer.isAreaLayer = true;
    layer.shape = this.tempShape;
    layer.color = this.tempColor;
  }

  /* =========================
     Update polygon dynamically
     ========================= */
  private updatePolygonFeature(feature: Feature, pointer?: [number, number]): void {
    if (!this.tempSource) return;

    const geom = feature.getGeometry() as Polygon;
    if (!geom) return;

    const coords = geom.getCoordinates()[0].slice(); // copy current coords

    if (pointer) coords.push(pointer);

    if (coords.length >= 3) {
      feature.setGeometry(new Polygon([coords]));
    }

    feature.set('featureType', 'polygon');

    if (!this.tempSource.getFeatures().includes(feature)) {
      this.tempSource.addFeature(feature);
    }

    // Permanent vertices
    if (!feature.get('verticesAdded')) {
      coords.forEach(c => {
        const vertex = new Feature(new Point(c));
        vertex.set('featureType', 'vertex');
        this.tempSource?.addFeature(vertex);
      });
      feature.set('verticesAdded', true);
    }

    // Remove old pointer vertex
    this.tempSource.getFeatures()
      .filter(f => f.get('featureType') === 'pointerVertex')
      .forEach(f => this.tempSource?.removeFeature(f));

    // Add dynamic pointer vertex
    if (pointer) {
      const pv = new Feature(new Point(pointer));
      pv.set('featureType', 'pointerVertex');
      this.tempSource.addFeature(pv);
    }

    // Remove old area labels
    this.tempSource.getFeatures()
      .filter(f => f.get('featureType') === 'label')
      .forEach(f => this.tempSource?.removeFeature(f));

    // Add area label at centroid
    if (coords.length >= 3) {
      const centroid = new Polygon([coords]).getInteriorPoint().getCoordinates();
      const areaMeters2 = getArea(new Polygon([coords]), { radius: PLANETS[this.planet].radius });
      const text = areaMeters2 >= 1_000_000
        ? `${(areaMeters2 / 1_000_000).toFixed(2)} km²`
        : `${areaMeters2.toFixed(1)} m²`;

      const label = new Feature(new Point(centroid));
      label.set('featureType', 'label');
      label.set('text', text);
      this.tempSource.addFeature(label);
    }

    // Style polygon with fill and stroke
    feature.setStyle(
      this.layerManager.styleService.getLayerStyle({
        type: 'polygon',
        baseColor: this.tempColor,
      })
    );

    // Update vertex styles
    this.applyLayerStyles();
  }
}