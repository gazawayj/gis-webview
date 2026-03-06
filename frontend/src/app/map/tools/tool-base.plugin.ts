import OlMap from 'ol/Map';
import type { Interaction } from 'ol/interaction';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import type { FeatureLike } from 'ol/Feature';
import { LayerManagerService } from '../services/layer-manager.service';
import { Tool } from './tool';
import { LayerConfig } from '../models/layer-config.model';
import { fromLonLat } from 'ol/proj';
import { extend as extendExtent, boundingExtent } from 'ol/extent';
import { LineString, Point } from 'ol/geom';
import TileLayer from 'ol/layer/Tile';
import { XYZ } from 'ol/source';

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

  // ----------------------- Activation -----------------------
  activate(map: OlMap): void {
    this.map = map;

    // Allocate unique style for this tool layer using StyleService
    const allocation = this.layerManager.styleService.allocateLayerStyle(this.layerManager.currentPlanet);

    // Create temporary tool layer
    this.activeLayer = this.layerManager.createLayer({
      planet: this.layerManager.currentPlanet,
      name: '__tool_temp__',
      isTemporary: true,
      shape: allocation.shape,
      color: allocation.color
    });

    if (!this.activeLayer) return;

    const olLayer = this.activeLayer.olLayer as VectorLayer<VectorSource<Feature>>;
    const source = olLayer.getSource();
    if (!source) return;
    this.tempSource = source;

    // Apply dynamic style using StyleService pipeline
    olLayer.setStyle((feature) => {
      if (!this.activeLayer) return [];

      const f = feature as Feature;
      const fType = f.get('featureType') || 'point';
      const text = f.get('text');

      return this.layerManager.styleService.getLayerStyle({
        type: fType,
        baseColor: this.activeLayer.color,
        shape: this.activeLayer.shape,
        text
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

  // ----------------------- Utilities -----------------------
  protected async flyToCoordinates(
    coords: [number, number][],
    options?: { addPointCallback?: (lon: number, lat: number) => void; minZoom?: number; maxZoom?: number }
  ): Promise<void> {
    if (!this.map || !coords.length) return;

    const view = this.map.getView();
    const minZoom = options?.minZoom ?? 6;
    const maxZoom = options?.maxZoom ?? 12;

    const projectedCoords = coords.map(c => fromLonLat(c) as [number, number]);

    const easeInOut = (t: number) => {
      return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };

    for (let i = 0; i < projectedCoords.length; i++) {
      const center = projectedCoords[i];

      await new Promise<void>((resolve) => {
        const currentZoom = view.getZoom() ?? 2;
        const targetZoom = Math.max(currentZoom, minZoom);

        view.animate(
          {
            center,
            duration: 1200,
            easing: easeInOut
          },
          {
            zoom: targetZoom,
            duration: 800,
            easing: easeInOut
          },
          () => resolve()
        );
      });

      if (options?.addPointCallback) {
        const [lon, lat] = coords[i];
        options.addPointCallback(lon, lat);
      }

      await new Promise(r => setTimeout(r, 300));
    }

    // Only fit if this represents an area, not animation steps
    if (projectedCoords.length > 2) {
      let extent = boundingExtent([projectedCoords[0], projectedCoords[0]]);
      projectedCoords.forEach(c => extendExtent(extent, c));

      await new Promise<void>((resolve) => {
        view.fit(extent, {
          padding: [50, 50, 50, 50],
          duration: 1200,
          maxZoom,
          easing: easeInOut
        });
        setTimeout(() => resolve(), 1200);
      });
    }
  }

  protected saveAsync(name: string): Promise<LayerConfig | null> {
    return Promise.resolve(this.save(name));
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

  // ----------------------- Save / Feature Helpers -----------------------
  save(name: string): LayerConfig | null {
    if (!this.tempSource || !this.activeLayer) return null;

    const allFeatures = this.tempSource.getFeatures()
      .filter(f => f.get('isToolFeature') === true);

    if (!allFeatures.length) return null;

    // Separate TileLayer from vector features
    let tileLayer: TileLayer<XYZ> | undefined;
    const vectorFeatures: Feature[] = [];

    allFeatures.forEach(f => {
      const tl = f.get('tileLayer') as TileLayer<XYZ> | undefined;
      if (tl) tileLayer = tl;
      else vectorFeatures.push(this.layerManager.cloneFeature(f, {
        isToolFeature: true,
        parentFeatureId: f.get('parentFeature')?.getId ? String(f.get('parentFeature').getId()) : undefined,
        shape: this.activeLayer?.shape
      }));
    });

    // Prepare layer creation parameters
    const layerParams: Parameters<typeof this.layerManager.createLayer>[0] = {
      planet: this.layerManager.currentPlanet,
      name,
      features: vectorFeatures,
      isTemporary: false,
      shape: this.activeLayer?.shape,
      color: this.activeLayer?.color,
      geometryType: this.activeLayer?.geometryType
    };

    // Pass TileLayer directly if present
    if (tileLayer) layerParams.olLayer = tileLayer;

    // Create a single layer (TileLayer + vector features combined)
    const newLayer = this.layerManager.createLayer(layerParams);

    // Ensure TileLayer is on the map
    if (tileLayer && this.map && !this.map.getLayers().getArray().includes(tileLayer)) {
      this.map.addLayer(tileLayer);
    }

    // Optional plugin hook
    if (this.onSave) this.onSave(newLayer);

    return newLayer;
  }

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

    if (['point', 'vertex', 'pointerVertex'].includes(featureType) && this.activeLayer) {
      f.set('shape', this.activeLayer.shape);
    }

    if (text) f.set('text', text);
    if (parentFeature) f.set('parentFeature', parentFeature);

    return f;
  }

  getFeatures(): FeatureLike[] {
    return this.tempSource?.getFeatures() ?? [];
  }

  protected createLine(coords: [number, number][]): LineString {
    return new LineString(coords.map(c => fromLonLat(c)));
  }

  protected createPoint(coord: [number, number]): Point {
    return new Point(fromLonLat(coord));
  }

  protected abstract onActivate(): void;
  protected onDeactivate(): void { }
  protected onSave?(layer: LayerConfig): void { }
}