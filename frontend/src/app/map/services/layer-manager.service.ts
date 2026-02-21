import { Injectable } from '@angular/core';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Map as OlMap } from 'ol';
import Feature, { FeatureLike } from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
import { StyleService } from './style.service';
import { ShapeType } from './symbol-constants';
import { HttpClient } from '@angular/common/http';
import Papa from 'papaparse';
import GeoJSON from 'ol/format/GeoJSON';
import { BASEMAP_URLS, FIRMS_CSV_URL, EARTHQUAKE_GEOJSON_URL } from '../map-constants';
import { Style } from 'ol/style';

export interface LayerConfig {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  shape: ShapeType | 'none';
  olLayer: TileLayer<XYZ> | VectorLayer<VectorSource>;
  isBasemap?: boolean;
  isTemporary?: boolean;
  isDistanceLayer?: boolean;
  _planet?: 'earth' | 'moon' | 'mars';
  styleFn?: (f: FeatureLike) => Style[];
}

@Injectable({ providedIn: 'root' })
export class LayerManagerService {
  private _map?: OlMap;

  public layers: LayerConfig[] = [];
  public currentPlanet: 'earth' | 'moon' | 'mars' = 'earth';

  private registry = new Map<string, LayerConfig>();
  private planetCache: Record<'earth' | 'moon' | 'mars', LayerConfig[]> = {
    earth: [],
    moon: [],
    mars: []
  };

  private basemapRegistry: Record<'earth' | 'moon' | 'mars', LayerConfig> = {
    earth: null!,
    moon: null!,
    mars: null!
  };

  constructor(public styleService: StyleService, private http: HttpClient) { }

  attachMap(map: OlMap) {
    this._map = map;
  }

  // ================= PLANET LOADING =================
  loadPlanet(planet: 'earth' | 'moon' | 'mars') {
    if (!this._map) return;
    this.saveCurrentMapLayersToCache();

    this._map.getLayers().clear();
    this.layers = [];
    this.currentPlanet = planet;

    const basemap = this.createBasemap(planet);
    this._map.addLayer(basemap.olLayer);

    this.initBuiltInLayers(planet);

    this.planetCache[planet].forEach(layer => {
      this._map!.addLayer(layer.olLayer);
      layer.olLayer.setVisible(layer.visible);
      if (!layer.isBasemap) this.layers.push(layer);
    });

    this.applyZOrder();
  }

  private saveCurrentMapLayersToCache() {
    if (!this._map) return;
    const layersOnMap = this._map.getLayers().getArray();
    const persistent: LayerConfig[] = [];

    layersOnMap.forEach(l => {
      const cfg = Array.from(this.registry.values()).find(c => c.olLayer === l);
      if (!cfg || cfg.isBasemap || cfg.isTemporary || cfg._planet !== this.currentPlanet) return;
      persistent.push(cfg);
    });

    this.planetCache[this.currentPlanet] = persistent;
  }

  // ================= LAYER CREATION =================
  createLayer(params: {
    planet: 'earth' | 'moon' | 'mars';
    name: string;
    features?: Feature[];
    shape?: ShapeType;
    color?: string;
    id?: string;
    cache?: boolean;
    isTemporary?: boolean;
    styleFn?: (f: FeatureLike) => Style[];
  }): LayerConfig | null {
    if (!this._map) return null;

    const { planet, name, features, shape, color, id, cache = true, isTemporary = false, styleFn } = params;
    const layerId = id || `${name}-${Date.now()}`;

    if (this.registry.has(layerId)) return this.registry.get(layerId)!;

    // Fixed color + shape per layer
    const layerColor = color || this.styleService.getRandomColor();
    const layerShape = shape || this.styleService.getRandomShape();

    const layerStyleFn = styleFn || ((f: FeatureLike) => {
      const type = layerShape === 'line' ? 'line' : 'point';
      return [this.styleService.getLayerStyle({ type, baseColor: layerColor, shape: layerShape })];
    });

    const vectorLayer = new VectorLayer({ source: new VectorSource(), style: layerStyleFn });

    const config: LayerConfig = {
      id: layerId,
      name,
      color: layerColor,
      shape: layerShape,
      visible: true,
      olLayer: vectorLayer,
      isTemporary,
      _planet: planet,
      styleFn: layerStyleFn
    };

    if (features?.length) vectorLayer.getSource()?.addFeatures(features.map(f => f.clone()));

    this.registry.set(layerId, config);

    if (cache && !isTemporary) this.planetCache[planet].push(config);
    if (planet === this.currentPlanet) {
      this._map.addLayer(config.olLayer);
      if (!config.isBasemap) this.layers.push(config);
    }

    this.applyZOrder();
    return config;
  }

  updateStyle(layer: LayerConfig) {
  if (!(layer.olLayer instanceof VectorLayer)) return;

  // Distance layer: update all features individually
  if (layer.isDistanceLayer) {
    const features = layer.olLayer.getSource()?.getFeatures();
    if (!features) return;

    features.forEach(f => {
      const geom = f.getGeometry();
      if (!geom) return;

      const type = geom.getType();

      if (type === 'LineString') {
        // line
        f.setStyle(this.styleService.getLayerStyle({
          type: 'line',
          baseColor: layer.color
        }));
      } else if (type === 'Point') {
        const isLabel = !!f.get('text');
        if (isLabel) {
          // label
          const text = f.get('text') as string;
          f.setStyle(this.styleService.getLayerStyle({
            type: 'label',
            baseColor: layer.color,
            text
          }));
        } else {
          // vertex
          const shape: ShapeType | undefined = layer.shape === 'none' ? this.styleService.getRandomShape() : (layer.shape as ShapeType);
          f.setStyle(this.styleService.getLayerStyle({
            type: 'point',
            baseColor: layer.color,
            shape
          }));
        }
      }
    });

    return;
  }

  // Regular layer
  layer.olLayer.setStyle((feature) => {
    if (layer.shape === 'line') {
      return [this.styleService.getLayerStyle({ type: 'line', baseColor: layer.color })];
    } else if (layer.shape === 'none') {
      return undefined;
    } else {
      return [this.styleService.getLayerStyle({ type: 'point', baseColor: layer.color, shape: layer.shape as ShapeType })];
    }
  });
}

  // ================= DISTANCE LAYER =================
  addLayer(planet: 'earth' | 'moon' | 'mars', name: string, features: Feature[], color?: string, styleFn?: (f: FeatureLike) => Style[]): LayerConfig | null {
    return this.createLayer({
      planet,
      name,
      features,
      shape: 'line',
      color,
      cache: true,
      isTemporary: false,
      styleFn
    });
  }

  // ================= REMOVE / TOGGLE =================
  remove(layer?: LayerConfig) {
    if (!layer || !this._map) return;

    this._map.removeLayer(layer.olLayer);
    this.registry.delete(layer.id);
    this.layers = this.layers.filter(l => l.id !== layer.id);

    Object.keys(this.planetCache).forEach(p => {
      this.planetCache[p as 'earth' | 'moon' | 'mars'] =
        this.planetCache[p as 'earth' | 'moon' | 'mars'].filter(l => l.id !== layer.id);
    });
  }

  toggle(layer: LayerConfig) {
    layer.visible = !layer.visible;
    layer.olLayer.setVisible(layer.visible);
  }

  // ================= BASEMAP / BUILT-IN LAYERS =================
  private createBasemap(planet: 'earth' | 'moon' | 'mars'): LayerConfig {
    if (this.basemapRegistry[planet]) return this.basemapRegistry[planet];

    const layer = new TileLayer({ source: new XYZ({ url: BASEMAP_URLS[planet] }), zIndex: 0 });
    const config: LayerConfig = {
      id: `basemap-${planet}`,
      name: 'Basemap',
      color: '#fff',
      shape: 'none',
      visible: true,
      olLayer: layer,
      isBasemap: true,
      _planet: planet
    };
    this.basemapRegistry[planet] = config;
    return config;
  }

  private initBuiltInLayers(planet: 'earth' | 'moon' | 'mars') {
    if (planet !== 'earth') return;
    if (this.planetCache.earth.length) return;

    // FIRMS
    this.http.get(FIRMS_CSV_URL, { responseType: 'text' }).subscribe(csv => {
      const features: Feature[] = [];
      const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
      parsed.data.forEach((r: any) => {
        const lat = parseFloat(r.latitude), lon = parseFloat(r.longitude);
        if (!isNaN(lat) && !isNaN(lon)) features.push(new Feature(new Point(fromLonLat([lon, lat]))));
      });
      const color = this.styleService.getRandomColor();
      const shape = this.styleService.getRandomShape();
      this.createLayer({ planet, name: 'FIRMS Fires', features, shape, color, cache: true });
    });

    // Earthquakes
    this.http.get(EARTHQUAKE_GEOJSON_URL, { responseType: 'text' }).subscribe(g => {
      const features = new GeoJSON().readFeatures(g, { featureProjection: 'EPSG:3857' });
      const color = this.styleService.getRandomColor();
      const shape = this.styleService.getRandomShape();
      this.createLayer({ planet, name: 'Earthquakes', features, shape, color, cache: true });
    });
  }

  // ================= UTILITIES =================
  applyZOrder() {
    if (!this._map) return;
    let z = 0;
    this._map.getLayers().forEach(l => l.setZIndex(z++));
  }

  reorderLayers(sidebarOrder: LayerConfig[]) {
    if (!this._map) return;
    this.layers = sidebarOrder;
    this.applyZOrder();
  }

  addManualLayer(planet: 'earth' | 'moon' | 'mars', name: string, description: string, fileContent?: string, sourceType: 'CSV' | 'GeoJSON' = 'CSV', latField?: string, lonField?: string) {
    const color = this.styleService.getRandomColor();
    const shape = this.styleService.getRandomShape();
    return this.createLayer({ planet, name, shape, color, cache: true });
  }
}