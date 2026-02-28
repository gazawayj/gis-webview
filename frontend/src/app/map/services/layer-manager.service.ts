import { Injectable, inject } from '@angular/core';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Map as OlMap } from 'ol';
import Feature, { FeatureLike } from 'ol/Feature';
import { Style } from 'ol/style';
import GeoJSON from 'ol/format/GeoJSON';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
import Papa from 'papaparse';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';

import { GeometryType, LayerConfig } from '../models/layer-config.model';
import { BASEMAP_URLS, FIRMS_CSV_URL, EARTHQUAKE_GEOJSON_URL } from '../constants/map-constants';
import { StyleService } from './style.service';
import { ShapeType } from '../constants/symbol-constants';
import { createVectorLayerFactory, LayerFactory } from '../factories/layer.factory';

@Injectable({ providedIn: 'root' })
export class LayerManagerService {
  public styleService = inject(StyleService);
  private http = inject(HttpClient);

  private _map?: OlMap;
  currentPlanet: 'earth' | 'moon' | 'mars' = 'earth';

  private registry = new Map<string, LayerConfig>();
  planetCache: Record<'earth' | 'moon' | 'mars', LayerConfig[]> = { earth: [], moon: [], mars: [] };
  private basemapRegistry: Record<'earth' | 'moon' | 'mars', LayerConfig> = { earth: null!, moon: null!, mars: null! };
  dragOrder: LayerConfig[] = [];

  private layerFactory: LayerFactory;

  /** Observable for UI to react to layers */
  private layersSubject = new BehaviorSubject<LayerConfig[]>([]);
  layers$ = this.layersSubject.asObservable();

  constructor() {
    this.layerFactory = createVectorLayerFactory(this.styleService);
  }

  attachMap(map: OlMap) {
    this._map = map;
  }

  getLayersForPlanet(planet: 'earth' | 'moon' | 'mars'): LayerConfig[] {
    return this.planetCache[planet].slice();
  }

  // ---------- CREATE VECTOR LAYER ----------
  createLayer(params: {
    planet: 'earth' | 'moon' | 'mars';
    name?: string;
    features?: FeatureLike[];
    shape?: ShapeType | 'line';
    color?: string;
    id?: string;
    cache?: boolean;
    isTemporary?: boolean;
    styleFn?: (f: FeatureLike) => Style | Style[];
    geometryType?: GeometryType; 
  }): LayerConfig {
    const {
      planet,
      name = `Layer-${Date.now()}`,
      features = [],
      shape,
      color,
      id,
      cache = true,
      isTemporary = false,
      styleFn,
      geometryType,
    } = params;

    const layerFeatures: Feature[] = features
      .filter(f => f instanceof Feature)
      .map(f => f.clone());

    const layerConfig = this.layerFactory(planet, {
      name,
      features: layerFeatures,
      shape,
      color,
      styleFn,
      isTemporary,
      geometryType, // ✅ propagate here
    });

    const layerId = id || layerConfig.id;

    if (!this.registry.has(layerId)) {
      this.registry.set(layerId, layerConfig);

      if (cache && !isTemporary) this.planetCache[planet].unshift(layerConfig);
      this.dragOrder.unshift(layerConfig);
      if (this._map) this._map.addLayer(layerConfig.olLayer);

      this.applyZOrder();
      this.layersSubject.next(this.getLayersForPlanet(this.currentPlanet));
    }

    return this.registry.get(layerId)!;
  }

  // ---------- ADD CSV OR GEOJSON LAYER ----------
  addManualLayer(
    planet: 'earth' | 'moon' | 'mars',
    name: string,
    description: string,
    fileContent?: string,
    sourceType: 'CSV' | 'GeoJSON' = 'CSV',
    latField?: string,
    lonField?: string
  ): LayerConfig | undefined {
    const features: Feature[] = [];

    if (fileContent) {
      try {
        if (sourceType === 'CSV') {
          const parsed = Papa.parse(fileContent, { header: true, skipEmptyLines: true });
          parsed.data.forEach((row: any) => {
            const lat = parseFloat(row[latField || 'latitude']);
            const lon = parseFloat(row[lonField || 'longitude']);
            if (!isNaN(lat) && !isNaN(lon)) {
              const coords = fromLonLat([lon, lat]);
              features.push(new Feature(new Point(coords)));
            }
          });
        } else if (sourceType === 'GeoJSON') {
          const geoFeatures = new GeoJSON().readFeatures(fileContent, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857',
          });
          features.push(...geoFeatures.filter(f => f instanceof Feature));
        }
      } catch (err) {
        console.warn('Failed to parse layer file', err);
      }
    }

    return this.createLayer({ planet, name, features });
  }

  // ---------- UPDATE STYLE ----------
  updateStyle(layer: LayerConfig) {
    if (!(layer.olLayer instanceof VectorLayer)) return;
    layer.olLayer.setStyle((feature: FeatureLike): Style | Style[] => {
      if (layer.styleFn) return layer.styleFn(feature);

      // Use geometryType on layer for proper default styling
      switch (layer.geometryType) {
        case 'line':
          return [this.styleService.getLayerStyle({ type: 'line', baseColor: layer.color })];
        case 'polygon':
          return [this.styleService.getLayerStyle({ type: 'polygon', baseColor: layer.color })];
        default:
          return [
            this.styleService.getLayerStyle({
              type: 'point',
              baseColor: layer.color,
              shape: layer.shape,
            }),
          ];
      }
    });
  }

  // ---------- REMOVE LAYER ----------
  remove(layer?: LayerConfig) {
    if (!layer || !this._map) return;

    this._map.removeLayer(layer.olLayer);
    this.registry.delete(layer.id);
    this.dragOrder = this.dragOrder.filter(l => l.id !== layer.id);
    Object.keys(this.planetCache).forEach(p => {
      this.planetCache[p as 'earth' | 'moon' | 'mars'] =
        this.planetCache[p as 'earth' | 'moon' | 'mars'].filter(l => l.id !== layer.id);
    });

    this.layersSubject.next(this.getLayersForPlanet(this.currentPlanet));
  }

  toggle(layer: LayerConfig) {
    layer.visible = !layer.visible;
    layer.olLayer.setVisible(layer.visible);
  }

  // ---------- BASEMAP ----------
  private createBasemap(planet: 'earth' | 'moon' | 'mars'): LayerConfig {
    if (this.basemapRegistry[planet]) return this.basemapRegistry[planet];
    const layer = new TileLayer({ source: new XYZ({ url: BASEMAP_URLS[planet] }), zIndex: 0 });
    const config: LayerConfig = {
      id: `basemap-${planet}`,
      geometryType: 'line',
      name: 'Basemap',
      color: '#fff',
      shape: 'none',
      visible: true,
      olLayer: layer,
      features: [],
      planet,
      isBasemap: true,
    };
    this.basemapRegistry[planet] = config;
    return config;
  }

  loadPlanet(planet: 'earth' | 'moon' | 'mars') {
    if (!this._map) return;

    const persistent: LayerConfig[] = [];
    this._map.getLayers().getArray().forEach(l => {
      const cfg = Array.from(this.registry.values()).find(c => c.olLayer === l);
      if (!cfg || cfg.isBasemap || cfg.isTemporary || cfg.planet !== this.currentPlanet) return;
      persistent.push(cfg);
    });
    this.planetCache[this.currentPlanet] = persistent;

    this._map.getLayers().clear();
    this.currentPlanet = planet;

    const basemap = this.createBasemap(planet);
    this._map.addLayer(basemap.olLayer);

    if (planet === 'earth') {
      this.http.get(FIRMS_CSV_URL, { responseType: 'text' }).subscribe(csv => {
        const layer = this.addManualLayer(planet, 'FIRMS Fires', 'FIRMS CSV', csv, 'CSV', 'latitude', 'longitude');
        if (layer) {
          layer.olLayer.setVisible(true);
          if (!this.dragOrder.includes(layer)) this.dragOrder.unshift(layer);
        }
      });

      this.http.get(EARTHQUAKE_GEOJSON_URL, { responseType: 'text' }).subscribe(g => {
        const layer = this.addManualLayer(planet, 'Earthquakes', 'USGS Earthquakes', g, 'GeoJSON');
        if (layer) {
          layer.olLayer.setVisible(true);
          if (!this.dragOrder.includes(layer)) this.dragOrder.unshift(layer);
        }
      });
    }

    this.planetCache[planet].forEach(layer => {
      if (!this.dragOrder.includes(layer)) this.dragOrder.push(layer);
      this._map?.addLayer(layer.olLayer);
      layer.olLayer.setVisible(layer.visible);
    });

    this.applyZOrder();
    this.layersSubject.next(this.getLayersForPlanet(this.currentPlanet));
  }

  applyZOrder() {
    if (!this._map) return;
    const nonBasemap = this.dragOrder.filter(l => !l.isBasemap);
    nonBasemap.slice().reverse().forEach((layer, idx) => {
      layer.olLayer.setZIndex(idx + 1);
    });
    this.dragOrder.filter(l => l.isBasemap).forEach(l => l.olLayer.setZIndex(0));
  }

  reorderLayers(sidebarOrder: LayerConfig[]) {
    sidebarOrder.slice().reverse().forEach((cfg, idx) => cfg.olLayer.setZIndex(idx + 1));
    this.dragOrder.filter(l => l.isBasemap).forEach(l => l.olLayer.setZIndex(0));
  }
}