import OlMap from 'ol/Map';
import type { Interaction } from 'ol/interaction';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import type { FeatureLike } from 'ol/Feature';
import { LayerManagerService } from '../services/layer-manager.service';
import { Tool } from './tool';
import { LayerConfig } from '../models/layer-config.model';

export abstract class ToolPluginBase implements Tool {
  abstract name: string;

  protected map?: OlMap;
  protected tempSource?: VectorSource<Feature>;
  protected activeLayer?: LayerConfig;

  private interactions: Interaction[] = [];
  private mapListeners: Array<{ type: string; handler: any }> = [];
  private domListeners: Array<{ target: EventTarget; type: string; handler: any }> = [];

  protected constructor(protected layerManager: LayerManagerService) {}

  // ------------------- ACTIVATE / DEACTIVATE -------------------
  activate(map: OlMap): void {
    this.map = map;

    this.activeLayer = this.layerManager.createLayer({
      planet: this.layerManager.currentPlanet,
      name: '__tool_temp__',
      isTemporary: true,
    });

    const olLayer = this.activeLayer.olLayer as VectorLayer<VectorSource<Feature>>;
    const source = olLayer.getSource();
    if (!source) return;
    this.tempSource = source;

    olLayer.setStyle((feature) => {
      const f = feature as Feature;
      const fType = f.get('featureType') || 'point';
      const text = f.get('text');
      return this.layerManager.styleService.getLayerStyle({
        type: fType,
        baseColor: this.activeLayer?.color,
        shape: this.activeLayer?.shape,
        text,
      });
    });

    this.onActivate();
  }

  deactivate(): void {
    this.onDeactivate();
    this.cleanupRegisteredResources();

    if (this.activeLayer) {
      this.layerManager.remove(this.activeLayer);
    }

    this.map = undefined;
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

    const featureMap = new Map<string, Feature>();

    const clonedFeatures = features.map((f) => {
      const clone = f.clone();
      const id = String(f.getId() ?? crypto.randomUUID());
      clone.setId(id);
      featureMap.set(id, clone);
      clone.set('isToolFeature', false);
      return clone;
    });

    clonedFeatures.forEach((f) => {
      const parent = f.get('parentFeature');
      if (parent && parent.getId) {
        f.set('parentFeatureId', String(parent.getId()));
        f.unset('parentFeature');
      }
    });

    const newLayer = this.layerManager.createLayer({
      planet: this.layerManager.currentPlanet,
      name,
      features: clonedFeatures,
      isTemporary: false,
    });

    return newLayer ?? null;
  }

  // ------------------- FEATURE CREATION -------------------
  protected createFeature(
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
    if (text) f.set('text', text);
    if (parentFeature) f.set('parentFeature', parentFeature);

    return f;
  }

  getFeatures(): FeatureLike[] {
    return this.tempSource?.getFeatures() ?? [];
  }

  // ------------------- ABSTRACT HOOKS -------------------
  protected abstract onActivate(): void;
  protected onDeactivate(): void {}
  protected onSave?(layer: LayerConfig): void {}
}