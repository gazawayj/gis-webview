import type Map from 'ol/Map';
import type { Interaction } from 'ol/interaction';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import type { FeatureLike } from 'ol/Feature';
import type { Style } from 'ol/style';
import { LayerManagerService } from '../services/layer-manager.service';
import { SHAPES, ShapeType } from '../services/symbol-constants';
import { ToolPlugin } from '../tools/tool-plugin';

export abstract class ToolPluginBase implements ToolPlugin {
  abstract name: string;

  protected map?: Map;
  protected tempSource?: VectorSource;
  protected tempLayer?: VectorLayer<VectorSource>;
  protected activeLayer?: any;

  protected tempColor: string;
  protected tempShape: ShapeType;
  protected planet: 'earth' | 'moon' | 'mars';

  /* =========================
     Auto-cleanup registries
     ========================= */

  private interactions: Interaction[] = [];
  private mapListeners: Array<{ type: string; handler: any }> = [];
  private domListeners: Array<{ target: EventTarget; type: string; handler: any }> = [];

  protected constructor(protected layerManager: LayerManagerService) {
    this.planet = layerManager.currentPlanet;

    this.tempColor = layerManager.styleService.getRandomColor();

    const randomShape = layerManager.styleService.getRandomShape();
    this.tempShape =
      randomShape && SHAPES.includes(randomShape) && randomShape !== 'line'
        ? randomShape
        : 'circle';
  }

  /* =========================
     Public lifecycle
     ========================= */

  activate(map: Map): void {
    this.map = map;

    this.tempSource = new VectorSource();

    this.tempLayer = new VectorLayer({
      source: this.tempSource,
      style: (f) => this.getFeatureStyle(f as Feature),
    });

    this.map.addLayer(this.tempLayer);

    this.onActivate();
  }

  deactivate(): void {
    this.onDeactivate();

    this.cleanupRegisteredResources();

    if (this.map && this.tempLayer) {
      this.map.removeLayer(this.tempLayer);
    }

    this.map = undefined;
    this.tempLayer = undefined;
    this.tempSource = undefined;
    this.activeLayer = undefined;
  }

  cancel(): void {
    this.deactivate();
  }

  /* =========================
     Registration helpers
     ========================= */

  protected registerInteraction(interaction: Interaction): void {
    if (!this.map) return;
    this.map.addInteraction(interaction);
    this.interactions.push(interaction);
  }

  protected registerMapListener(type: string, handler: any): void {
    if (!this.map) return;
    this.map.on(type as any, handler);
    this.mapListeners.push({ type, handler });
  }

  protected registerDomListener(
    target: EventTarget,
    type: string,
    handler: any
  ): void {
    target.addEventListener(type, handler);
    this.domListeners.push({ target, type, handler });
  }

  /* =========================
     Cleanup
     ========================= */

  private cleanupRegisteredResources(): void {
    if (!this.map) return;

    this.interactions.forEach((i) => this.map?.removeInteraction(i));
    this.interactions = [];

    this.mapListeners.forEach(({ type, handler }) =>
      this.map?.un(type as any, handler)
    );
    this.mapListeners = [];

    this.domListeners.forEach(({ target, type, handler }) =>
      target.removeEventListener(type, handler)
    );
    this.domListeners = [];
  }

  /* =========================
     Save pipeline (unchanged)
     ========================= */

  save(name: string): void {
    if (!this.tempSource || !this.tempSource.getFeatures().length) return;

    const clonedFeatures: Feature[] = [];

    this.tempSource.getFeatures().forEach((f) => {
      const geom = f.getGeometry();
      if (!geom) return;

      const clone = f.clone() as Feature;

      clone.set('featureType', f.get('featureType'));
      clone.set('text', f.get('text'));

      clonedFeatures.push(clone);
    });

    this.activeLayer = this.layerManager.addLayer(
      this.planet,
      name,
      clonedFeatures,
      this.tempColor
    );

    if (this.activeLayer) {
      this.activeLayer.shape = this.tempShape;
      this.activeLayer.color = this.tempColor;

      this.applyLayerStyles();
      this.onSave(this.activeLayer);
    }

    this.deactivate();
  }

  updateLayerStyle(shape?: ShapeType, color?: string): void {
    if (!this.activeLayer) return;

    if (shape) this.activeLayer.shape = shape;
    if (color) this.activeLayer.color = color;

    this.applyLayerStyles();
  }

  protected applyLayerStyles(): void {
    if (!this.activeLayer) return;

    this.activeLayer.olLayer
      .getSource()
      ?.getFeatures()
      .forEach((f: Feature) => {
        const type = f.get('featureType');

        f.setStyle(
          this.layerManager.styleService.getLayerStyle({
            type:
              type === 'label'
                ? 'label'
                : type === 'line'
                ? 'line'
                : 'point',
            baseColor: this.activeLayer.color,
            shape: type === 'vertex' ? this.activeLayer.shape : undefined,
            text: f.get('text'),
          })
        );
      });
  }

  protected getFeatureStyle(feature: Feature): Style | Style[] {
    const color = this.activeLayer?.color || this.tempColor;
    const shape = this.activeLayer?.shape || this.tempShape;
    const type = feature.get('featureType');

    if (type === 'label' || feature.get('text')) {
      return this.layerManager.styleService.getLayerStyle({
        type: 'label',
        baseColor: color,
        text: feature.get('text'),
      });
    }

    if (type === 'line') {
      return this.layerManager.styleService.getLayerStyle({
        type: 'line',
        baseColor: color,
      });
    }

    return this.layerManager.styleService.getLayerStyle({
      type: 'point',
      baseColor: color,
      shape,
    });
  }

  /* =========================
     Hooks for tools
     ========================= */

  protected abstract onActivate(): void;
  protected onDeactivate(): void {}
  protected onSave(_layer: any): void {}

  getFeatures?(): FeatureLike[] {
    return this.tempSource?.getFeatures() ?? [];
  }

  getStyle?(feature: FeatureLike): Style[] {
    const style = this.getFeatureStyle(feature as Feature);
    return Array.isArray(style) ? style : [style];
  }
}