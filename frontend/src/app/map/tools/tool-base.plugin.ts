import type Map from 'ol/Map';
import type { Interaction } from 'ol/interaction';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import type { FeatureLike } from 'ol/Feature';
import { Fill, Stroke, Style } from 'ol/style';
import { LayerManagerService } from '../services/layer-manager.service';
import { SHAPES, ShapeType } from '../constants/symbol-constants';
import { Tool } from './tool';
import { LayerConfig } from '../models/layer-config.model';

export abstract class ToolPluginBase implements Tool {
  abstract name: string;

  protected map?: Map;
  protected tempSource?: VectorSource<Feature>;
  protected tempLayer?: VectorLayer<VectorSource<Feature>>;
  protected activeLayer?: LayerConfig;

  protected tempColor: string;
  protected tempShape: ShapeType;

  private interactions: Interaction[] = [];
  private mapListeners: Array<{ type: string; handler: any }> = [];
  private domListeners: Array<{ target: EventTarget; type: string; handler: any }> = [];

  protected constructor(protected layerManager: LayerManagerService) {
    this.tempColor = layerManager.styleService.getRandomColor();
    const randomShape = layerManager.styleService.getRandomShape();
    this.tempShape =
      randomShape && SHAPES.includes(randomShape) && randomShape !== 'line'
        ? randomShape
        : 'circle';
  }

  // ------------------- ACTIVATE / DEACTIVATE -------------------
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
    if (this.map && this.tempLayer) this.map.removeLayer(this.tempLayer);

    this.map = undefined;
    this.tempLayer = undefined;
    this.tempSource = undefined;
    this.activeLayer = undefined;
  }

  cancel(): void {
    this.deactivate();
  }

  // ------------------- REGISTER / CLEANUP -------------------
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

  protected registerDomListener(target: EventTarget, type: string, handler: any): void {
    target.addEventListener(type, handler);
    this.domListeners.push({ target, type, handler });
  }

  private cleanupRegisteredResources(): void {
    this.interactions.forEach((i) => this.map?.removeInteraction(i));
    this.interactions = [];

    this.mapListeners.forEach(({ type, handler }) => this.map?.un(type as any, handler));
    this.mapListeners = [];

    this.domListeners.forEach(({ target, type, handler }) => target.removeEventListener(type, handler));
    this.domListeners = [];
  }

  // ------------------- SAVE -------------------
  save(name: string): LayerConfig | null {
  if (!this.tempSource) return null;

  const features = this.tempSource.getFeatures();
  if (!features.length) return null;

  // CLONE FEATURES FIRST — preserves labels
  const clonedFeatures = features.map(f => f.clone());

  const newLayer = this.layerManager.createLayer({
    planet: this.layerManager.currentPlanet,
    name,
    features: clonedFeatures,
    shape: this.tempShape,
    color: this.tempColor,
    styleFn: undefined,
    isTemporary: false,
  });

  return newLayer ?? null;
}

  // ------------------- STYLING -------------------
  updateLayerStyle(shape?: ShapeType, color?: string): void {
    if (!this.activeLayer) return;
    if (shape) this.activeLayer.shape = shape;
    if (color) this.activeLayer.color = color;
    this.applyLayerStyles();
  }

  protected applyLayerStyles(): void {
    if (!this.activeLayer || !this.activeLayer.olLayer) return;

    if (this.activeLayer.olLayer instanceof VectorLayer) {
      const features = (this.activeLayer.olLayer.getSource() as VectorSource<Feature>)?.getFeatures() || [];
      features.forEach(f => f.setStyle(this.getFeatureStyle(f)));
    }
  }

  protected getFeatureStyle(feature: Feature): Style[] {
    const color = this.activeLayer?.color || this.tempColor;
    const shape = this.activeLayer?.shape || this.tempShape;
    const fType = feature.get('featureType');

    if (fType === 'line') return [new Style({ stroke: new Stroke({ color, width: 3 }) })];
    if (fType === 'polygon') return [new Style({ stroke: new Stroke({ color, width: 2 }), fill: new Fill({ color: color + '33' }) })];
    if (fType === 'label') return [this.layerManager.styleService.getLayerStyle({ type: 'label', baseColor: color, text: feature.get('text') as string | undefined })];

    return [this.layerManager.styleService.getLayerStyle({ type: 'point', baseColor: color, shape })];
  }

  getFeatures(): FeatureLike[] {
    return this.tempSource?.getFeatures() ?? [];
  }

  // ------------------- ABSTRACT HOOKS -------------------
  protected abstract onActivate(): void;
  protected onDeactivate(): void { }
  protected onSave?(layer: LayerConfig): void { }

  // ------------------- UTILITY -------------------
  protected createStyledFeature(
    geom: import('ol/geom').Geometry,
    featureType: 'point' | 'vertex' | 'pointerVertex' | 'line' | 'label' | 'polygon',
    text?: string,
    parentFeature?: Feature,
    isToolFeature: boolean = true
  ): Feature {
    const f = new Feature(geom);

    if (!f.getId()) f.setId(crypto.randomUUID());
    f.set('featureType', featureType);
    f.set('isToolFeature', isToolFeature);
    f.set('isDistanceTool', true);
    if (parentFeature) f.set('parentFeature', parentFeature);

    const styleOpts: any = {
      type: featureType === 'label' ? 'label' : featureType === 'line' ? 'line' : 'point',
      baseColor: this.activeLayer?.color || this.tempColor,
      shape: this.activeLayer?.shape || this.tempShape
    };
    if (text) styleOpts.text = text;

    f.setStyle(this.layerManager.styleService.getLayerStyle(styleOpts));
    return f;
  }
}