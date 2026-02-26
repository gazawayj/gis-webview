import { Injectable, inject } from '@angular/core';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Map as OlMap } from 'ol';
import Feature, { FeatureLike } from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
import { StyleService } from './style.service';
import { SHAPES, ShapeType } from '../constants/symbol-constants';
import { HttpClient } from '@angular/common/http';
import Papa from 'papaparse';
import GeoJSON from 'ol/format/GeoJSON';
import { BASEMAP_URLS, FIRMS_CSV_URL, EARTHQUAKE_GEOJSON_URL } from '../constants/map-constants';
import { Style } from 'ol/style';

export interface LayerConfig {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  shape: ShapeType | 'none';
  olLayer: TileLayer | VectorLayer;
  isBasemap?: boolean;
  isTemporary?: boolean;
  isDistanceLayer?: boolean;
  _planet?: 'earth' | 'moon' | 'mars';
  styleFn?: (f: FeatureLike) => Style[];
}

@Injectable({ providedIn: 'root' })
export class LayerManagerService {
  styleService = inject(StyleService);
  private http = inject(HttpClient);

  private _map?: OlMap;
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

  attachMap(map: OlMap) {
    this._map = map;
  }

  // ========================= LAYER LIST GETTER =========================
  get layers(): LayerConfig[] {
    if (!this._map) return [];
    return this._map.getLayers().getArray()
      .map(l => Array.from(this.registry.values()).find(c => c.olLayer === l))
      .filter((c): c is LayerConfig => !!c);
  }

  // ================= PLANET LOADING =================
  loadPlanet(planet: 'earth' | 'moon' | 'mars') {
    if (!this._map) return;
    this.saveCurrentMapLayersToCache();

    this._map.getLayers().clear();
    this.currentPlanet = planet;

    const basemap = this.createBasemap(planet);
    this._map.addLayer(basemap.olLayer);

    this.initBuiltInLayers(planet);

    this.planetCache[planet].forEach(layer => {
      this._map!.addLayer(layer.olLayer);
      layer.olLayer.setVisible(layer.visible);
    });

    this.applyZOrder();
  }

  private saveCurrentMapLayersToCache() {
    if (!this._map) return;
    const persistent: LayerConfig[] = [];

    this._map.getLayers().getArray().forEach(l => {
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

    const layerColor = color || this.styleService.getRandomColor();
    const layerShape: ShapeType = (shape && SHAPES.includes(shape) && shape !== 'line')
      ? shape
      : this.styleService.getRandomShape() || 'circle';

    const layerStyleFn = styleFn || ((_f: FeatureLike) => {
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

    if (cache && !isTemporary) this.planetCache[planet].unshift(config);

    const layersArray = this._map.getLayers().getArray();
    const basemapCount = layersArray.filter(l => {
      const cfg = Array.from(this.registry.values()).find(c => c.olLayer === l);
      return cfg?.isBasemap;
    }).length;

    this._map.getLayers().insertAt(basemapCount, vectorLayer);

    this.applyZOrder();

    return config;
  }

  // ================= STYLE / DISTANCE =================
  updateStyle(layer: LayerConfig) {
    if (!(layer.olLayer instanceof VectorLayer)) return;

    if (layer.isDistanceLayer) {
      const features = layer.olLayer.getSource()?.getFeatures();
      if (!features) return;

      features.forEach(f => {
        const geom = f.getGeometry();
        if (!geom) return;

        const type = geom.getType();
        if (type === 'LineString') {
          f.setStyle(this.styleService.getLayerStyle({ type: 'line', baseColor: layer.color }));
        } else if (type === 'Point') {
          const isLabel = !!f.get('text');
          if (isLabel) {
            const text = f.get('text') as string;
            f.setStyle(this.styleService.getLayerStyle({ type: 'label', baseColor: layer.color, text }));
          } else {
            const shape: ShapeType = layer.shape && layer.shape !== 'none' ? layer.shape : 'circle';
            f.setStyle(this.styleService.getLayerStyle({ type: 'point', baseColor: layer.color, shape }));
          }
        }
      });
      return;
    }

    const defaultShape: ShapeType = (layer.shape && layer.shape !== 'none') ? layer.shape : 'circle';
    layer.olLayer.setStyle((_f) => {
      if (layer.shape === 'line') return [this.styleService.getLayerStyle({ type: 'line', baseColor: layer.color })];
      return [this.styleService.getLayerStyle({ type: 'point', baseColor: layer.color, shape: defaultShape })];
    });
  }

  // ================= REMOVE / TOGGLE =================
  remove(layer?: LayerConfig) {
    if (!layer || !this._map) return;
    this._map.removeLayer(layer.olLayer);
    this.registry.delete(layer.id);

    Object.keys(this.planetCache).forEach(p => {
      this.planetCache[p as 'earth' | 'moon' | 'mars'] =
        this.planetCache[p as 'earth' | 'moon' | 'mars'].filter(l => l.id !== layer.id);
    });
  }

  toggle(layer: LayerConfig) {
    layer.visible = !layer.visible;
    layer.olLayer.setVisible(layer.visible);
  }

  // ================= BASEMAP =================
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
    if (planet !== 'earth' || this.planetCache.earth.length) return;

    this.http.get(FIRMS_CSV_URL, { responseType: 'text' }).subscribe(csv => {
      const features: Feature[] = [];
      const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
      parsed.data.forEach((r: any) => {
        const lat = parseFloat(r.latitude), lon = parseFloat(r.longitude);
        if (!isNaN(lat) && !isNaN(lon)) features.push(new Feature(new Point(fromLonLat([lon, lat]))));
      });
      const color = this.styleService.getRandomColor();
      const shape = this.styleService.getRandomShape() || 'circle';
      this.createLayer({ planet, name: 'FIRMS Fires', features, shape, color, cache: true, isTemporary: false });
    });

    this.http.get(EARTHQUAKE_GEOJSON_URL, { responseType: 'text' }).subscribe(g => {
      const features = new GeoJSON().readFeatures(g, { featureProjection: 'EPSG:3857' });
      const color = this.styleService.getRandomColor();
      const shape = this.styleService.getRandomShape() || 'circle';
      this.createLayer({ planet, name: 'Earthquakes', features, shape, color, cache: true });
    });
  }

  // ================= Z-ORDER =================
  applyZOrder() {
    if (!this._map) return;

    const nonBasemap = this.layers.filter(l => !l.isBasemap);
    // Reverse so top of sidebar = highest zIndex
    nonBasemap.slice().reverse().forEach((layer, idx) => {
      layer.olLayer.setZIndex(idx + 1);
    });

    this.layers.filter(l => l.isBasemap).forEach(l => l.olLayer.setZIndex(0));
  }

  reorderLayers(sidebarOrder: LayerConfig[]) {
    if (!this._map) return;

    const basemapLayers = this.layers.filter(l => l.isBasemap);
    // Reverse sidebarOrder so top of sidebar = top zIndex
    sidebarOrder.slice().reverse().forEach((cfg, idx) => {
      cfg.olLayer.setZIndex(idx + 1);
    });

    basemapLayers.forEach(l => l.olLayer.setZIndex(0));
  }

  addManualLayer(
    planet: 'earth' | 'moon' | 'mars',
    name: string,
    _description: string,
    _fileContent?: string,
    _sourceType: 'CSV' | 'GeoJSON' = 'CSV',
    _latField?: string,
    _lonField?: string
  ) {
    const color = this.styleService.getRandomColor();
    const randomShape = this.styleService.getRandomShape();
    const shape: ShapeType = (randomShape && SHAPES.includes(randomShape) && randomShape !== 'line')
      ? randomShape
      : 'circle';

    return this.createLayer({ planet, name, shape, color, cache: true });
  }
}