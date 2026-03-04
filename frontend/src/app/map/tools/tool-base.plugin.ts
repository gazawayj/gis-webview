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
  public tempSource?: VectorSource<Feature>;
  protected activeLayer?: LayerConfig;

  private interactions: Interaction[] = [];
  protected liveLabels: Feature[] = [];
  private mapListeners: Array<{ type: string; handler: any }> = [];
  private domListeners: Array<{ target: EventTarget; type: string; handler: any }> = [];

  constructor(protected layerManager: LayerManagerService) { }

  activate(map: OlMap): void {
    this.map = map;

    this.activeLayer = this.layerManager.createLayer({
      planet: this.layerManager.currentPlanet,
      name: '__tool_temp__',
      isTemporary: true,
    });

    if (!this.activeLayer) return;

    const olLayer = this.activeLayer.olLayer as VectorLayer<VectorSource<Feature>>;
    const source = olLayer.getSource();
    if (!source) return;
    this.tempSource = source;

    olLayer.setStyle((feature) => {
      if (!this.activeLayer) return [];

      const f = feature as Feature;
      const fType = f.get('featureType') || 'point';
      const text = f.get('text');

      return this.layerManager.styleService.getLayerStyle({
        type: fType,
        baseColor: this.activeLayer.color,
        shape: this.activeLayer.shape,
        text,
      });
    });

    this.onActivate();
  }

  deactivate(): void {
    this.onDeactivate();
    this.cleanupRegisteredResources();

    if (this.activeLayer) this.layerManager.remove(this.activeLayer);

    this.map = undefined;
    this.tempSource = undefined;
    this.activeLayer = undefined;
  }

  cancel(): void {
    this.deactivate();
  }

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

  /**
   * Standardized save() using LayerManagerService.cloneFeature
   */
  save(name: string): LayerConfig | null {
    if (!this.tempSource) return null;

    const allFeatures = this.tempSource.getFeatures().map(f =>
      this.layerManager.cloneFeature(f, {
        isToolFeature: !(f.get('featureType') === 'label' || f.get('featureType') === 'vertex' || f.get('featureType') === 'pointerVertex'),
        parentFeatureId: f.get('parentFeature')?.getId ? String(f.get('parentFeature').getId()) : undefined,
        shape: this.activeLayer?.shape
      })
    );

    const newLayer = this.layerManager.createLayer({
      planet: this.layerManager.currentPlanet,
      name,
      features: allFeatures,
      isTemporary: false,
    });

    if (newLayer) this.layerManager.styleService.setLayerShape(newLayer.id, newLayer.shape);

    return newLayer ?? null;
  }

  protected createFeature(
    geom: import('ol/geom').Geometry,
    featureType: 'point' | 'vertex' | 'pointerVertex' | 'line' | 'label' | 'polygon',
    text?: string,
    parentFeature?: Feature,
    isToolFeature: boolean = true,
    persistLabel: boolean = false
  ): Feature {
    const f = new Feature(geom);
    if (!f.getId()) f.setId(crypto.randomUUID());

    f.set('featureType', featureType);
    f.set('isToolFeature', isToolFeature);

    if (['point', 'vertex', 'pointerVertex'].includes(featureType) && this.activeLayer) {
      f.set('shape', this.activeLayer.shape);
    }

    if (text) f.set('text', text);
    if (parentFeature) f.set('parentFeature', parentFeature);

    if (featureType === 'label' && persistLabel) {
      f.set('isToolFeature', false);
      this.liveLabels.push(f);
    }

    return f;
  }

  getFeatures(): FeatureLike[] {
    return this.tempSource?.getFeatures() ?? [];
  }

  protected abstract onActivate(): void;
  protected onDeactivate(): void { }
  protected onSave?(layer: LayerConfig): void { }
}