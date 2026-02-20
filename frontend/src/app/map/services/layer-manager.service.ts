// frontend/src/app/services/layer-manager.service.ts

import { Injectable } from '@angular/core';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Map as OlMap } from 'ol';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
import { StyleService } from './style.service';
import { ShapeType } from './symbol-constants';
import { HttpClient } from '@angular/common/http';
import Papa from 'papaparse';
import GeoJSON from 'ol/format/GeoJSON';
import { BASEMAP_URLS, FIRMS_CSV_URL, EARTHQUAKE_GEOJSON_URL } from '../map-constants';

export interface LayerConfig {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  shape: ShapeType | 'none';
  olLayer: TileLayer<XYZ> | VectorLayer<VectorSource>;
  isBasemap?: boolean;
  isTemporary?: boolean;
  _planet?: 'earth' | 'moon' | 'mars';
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

  constructor(public styleService: StyleService, private http: HttpClient) {}

  attachMap(map: OlMap) {
    this._map = map;
  }

  // ================================
  // 🌍 PLANET LOADING (FINAL)
  // ================================
  loadPlanet(planet: 'earth' | 'moon' | 'mars') {
    if (!this._map) return;

    // ⭐ STEP 1 — SAVE CURRENT PLANET STATE
    this.saveCurrentMapLayersToCache();

    // ⭐ STEP 2 — CLEAR MAP
    this._map.getLayers().clear();
    this.layers = [];

    // ⭐ STEP 3 — SET NEW PLANET
    this.currentPlanet = planet;

    // ⭐ STEP 4 — ADD BASEMAP
    const basemap = this.createBasemap(planet);
    this._map.addLayer(basemap.olLayer);

    // ⭐ STEP 5 — ENSURE BUILT-INS EXIST
    this.initBuiltInLayers(planet);

    // ⭐ STEP 6 — LOAD PLANET CACHE
    this.planetCache[planet].forEach(layer => {
      this._map!.addLayer(layer.olLayer);
      layer.olLayer.setVisible(layer.visible);

      if (!layer.isBasemap) this.layers.push(layer);
    });

    // ⭐ STEP 7 — Z ORDER
    this.applyZOrder();
  }

  // ================================
  // 💾 SAVE PLANET STATE
  // ================================
  private saveCurrentMapLayersToCache() {
    if (!this._map) return;

    const layersOnMap = this._map.getLayers().getArray();

    const persistent: LayerConfig[] = [];

    layersOnMap.forEach(l => {
      const cfg = Array.from(this.registry.values()).find(c => c.olLayer === l);
      if (!cfg) return;

      if (cfg.isBasemap) return;
      if (cfg.isTemporary) return;
      if (cfg._planet !== this.currentPlanet) return;

      persistent.push(cfg);
    });

    this.planetCache[this.currentPlanet] = persistent;
  }

  // ================================
  // 🧱 LAYER CREATION
  // ================================
  createLayer(params: {
    planet: 'earth' | 'moon' | 'mars';
    name: string;
    features?: Feature[];
    shape?: ShapeType;
    color?: string;
    id?: string;
    cache?: boolean;
    isTemporary?: boolean;
  }): LayerConfig | null {
    if (!this._map) return null;

    const {
      planet,
      name,
      features,
      shape,
      color,
      id,
      cache = true,
      isTemporary = false
    } = params;

    const layerId = id || `${name}-${Date.now()}`;

    if (this.registry.has(layerId)) return this.registry.get(layerId)!;

    const vectorLayer = new VectorLayer({
      source: new VectorSource(),
      style: () => this.styleService.getStyle(color!, shape!)
    });

    const config: LayerConfig = {
      id: layerId,
      name,
      color: color!,
      shape: shape!,
      visible: true,
      olLayer: vectorLayer,
      isTemporary,
      _planet: planet
    };

    if (features?.length) {
      vectorLayer.getSource()?.addFeatures(features.map(f => f.clone()));
    }

    this.registry.set(layerId, config);

    // Cache if permanent
    if (cache && !isTemporary) {
      this.planetCache[planet].push(config);
    }

    // Add to map if active planet
    if (planet === this.currentPlanet) {
      this._map.addLayer(config.olLayer);
      if (!config.isBasemap) this.layers.push(config);
    }

    this.applyZOrder();
    return config;
  }

  // ================================
  // 📏 DISTANCE LAYER
  // ================================
  addDistanceLayer(planet: 'earth' | 'moon' | 'mars', name: string, features: Feature[]) {
    return this.createLayer({
      planet,
      name,
      features,
      shape: 'line',
      color: this.styleService.getRandomColor(),
      cache: true,
      isTemporary: false
    });
  }

  // ================================
  // 🗑 REMOVE LAYER
  // ================================
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

  // ================================
  // 🗺 BASEMAP
  // ================================
  private createBasemap(planet: 'earth' | 'moon' | 'mars'): LayerConfig {
    if (this.basemapRegistry[planet]) return this.basemapRegistry[planet];

    const layer = new TileLayer({
      source: new XYZ({ url: BASEMAP_URLS[planet] }),
      zIndex: 0
    });

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

  // ================================
  // 🔥 BUILT-INS
  // ================================
  private initBuiltInLayers(planet: 'earth' | 'moon' | 'mars') {
    if (planet !== 'earth') return;

    if (!this.planetCache.earth.length) {
      this.http.get(FIRMS_CSV_URL, { responseType: 'text' }).subscribe(csv => {
        const features: Feature[] = [];
        const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });

        parsed.data.forEach((r: any) => {
          const lat = parseFloat(r.latitude);
          const lon = parseFloat(r.longitude);
          if (!isNaN(lat) && !isNaN(lon)) {
            features.push(new Feature(new Point(fromLonLat([lon, lat]))));
          }
        });

        this.createLayer({
          planet: 'earth',
          name: 'FIRMS Fires',
          features,
          shape: 'circle',
          color: '#ff3300',
          cache: true
        });
      });

      this.http.get(EARTHQUAKE_GEOJSON_URL, { responseType: 'text' }).subscribe(g => {
        const features = new GeoJSON().readFeatures(g, { featureProjection: 'EPSG:3857' });

        this.createLayer({
          planet: 'earth',
          name: 'Earthquakes',
          features,
          shape: 'triangle',
          color: '#0077ff',
          cache: true
        });
      });
    }
  }

  // ================================
  // 🔢 Z ORDER
  // ================================
  applyZOrder() {
    if (!this._map) return;

    let z = 0;
    this._map.getLayers().forEach(l => l.setZIndex(z++));
  }

  // ================= SIDEBAR SUPPORT =================

  reorderLayers(sidebarOrder: LayerConfig[]) {
    if (!this._map) return;
    this.layers = sidebarOrder;
    this.applyZOrder();
  }

  toggle(layer: LayerConfig) {
    layer.visible = !layer.visible;
    layer.olLayer.setVisible(layer.visible);
  }

  updateStyle(layer: LayerConfig) {
    if (!(layer.olLayer instanceof VectorLayer)) return;
    layer.olLayer.setStyle(() =>
      this.styleService.getStyle(layer.color, layer.shape)
    );
  }

  addManualLayer(
    planet: 'earth' | 'moon' | 'mars',
    name: string,
    description: string,
    fileContent?: string,
    sourceType: 'CSV' | 'GeoJSON' = 'CSV',
    latField?: string,
    lonField?: string
  ) {
    // Uses existing createLayer pipeline
    return this.createLayer({
      planet,
      name,
      shape: 'circle',
      color: this.styleService.getRandomColor(),
      cache: true
    });
  }
}