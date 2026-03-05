import { Injectable, inject } from '@angular/core';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import VectorLayer from 'ol/layer/Vector';
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
import VectorSource from 'ol/source/Vector';

type Planet = 'earth' | 'moon' | 'mars';

@Injectable({ providedIn: 'root' })
export class LayerManagerService {
  public styleService = inject(StyleService);
  private http = inject(HttpClient);

  private _map?: OlMap;

  currentPlanet: Planet = 'mars';

  private registry = new Map<string, LayerConfig>();
  planetCache: Record<Planet, LayerConfig[]> = { earth: [], moon: [], mars: [] };

  private basemapRegistry: Record<Planet, LayerConfig> = { earth: null!, moon: null!, mars: null! };
  private planetInitialized: Record<Planet, boolean> = { earth: false, moon: false, mars: false };

  dragOrder: LayerConfig[] = [];
  private layerFactory: LayerFactory;

  private layersSubject = new BehaviorSubject<LayerConfig[]>([]);
  layers$ = this.layersSubject.asObservable();

  private activeLoads = 0;
  private spinnerMessage: string | null = null;
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();
  private messageSubject = new BehaviorSubject<string>('Loading...');
  public loadingMessage$ = this.messageSubject.asObservable();

  constructor() {
    this.layerFactory = createVectorLayerFactory(this.styleService);
  }

  attachMap(map: OlMap) {
    this._map = map;
  }

  private beginLoad(message?: string) {
    this.activeLoads++;
    if (message) this.spinnerMessage = message;
    if (this.activeLoads === 1) {
      this.messageSubject.next(this.spinnerMessage || 'Loading...');
      this.loadingSubject.next(true);
    }
  }

  private endLoad() {
    this.activeLoads = Math.max(0, this.activeLoads - 1);
    if (this.activeLoads === 0) {
      this.loadingSubject.next(false);
      this.spinnerMessage = null;
      this.messageSubject.next('');
    }
    this.applyZOrder();
  }

  public startExternalLoad(message?: string) { this.beginLoad(message); }
  public endExternalLoad() { this.endLoad(); }

  getLayersForPlanet(planet: Planet) {
    return this.planetCache[planet].slice();
  }

  /** Helper to refresh sidebar for a planet */
  private refreshLayersForPlanet(planet: Planet) {
    if (this.currentPlanet === planet) {
      this.layersSubject.next(this.getLayersForPlanet(planet));
    }
  }

  private initializePlanet(planet: Planet) {
    if (this.planetInitialized[planet]) return;

    if (planet === 'earth') {
      this.beginLoad('Loading FIRMS Fires...');
      this.http.get(FIRMS_CSV_URL, { responseType: 'text' }).subscribe({
        next: csv => {
          this.addManualLayer(
            'earth',
            'FIRMS Fires',
            'FIRMS CSV',
            csv,
            'CSV',
            'latitude',
            'longitude',
            'system-firms'
          );
          this.refreshLayersForPlanet('earth');
          this.endLoad();
        },
        error: () => this.endLoad()
      });

      this.beginLoad('Loading USGS Earthquakes...');
      this.http.get(EARTHQUAKE_GEOJSON_URL, { responseType: 'text' }).subscribe({
        next: g => {
          this.addManualLayer(
            'earth',
            'Earthquakes',
            'USGS Earthquakes',
            g,
            'GeoJSON',
            undefined,
            undefined,
            'system-earthquakes'
          );
          this.refreshLayersForPlanet('earth');
          this.endLoad();
        },
        error: () => this.endLoad()
      });
    }

    if (planet === 'mars') {
      this.addMarsBuiltInLayers();
    }

    this.planetInitialized[planet] = true;
  }

  loadPlanet(planet: Planet) {
    if (!this._map) return;

    this.currentPlanet = planet;
    this.initializePlanet(planet);

    this._map.getLayers().clear();
    const basemap = this.createBasemap(planet);
    this._map.addLayer(basemap.olLayer);

    this.dragOrder
      .filter(l => l.planet === planet && !l.isBasemap)
      .slice()
      .reverse()
      .forEach(layer => {
        this._map!.addLayer(layer.olLayer);
        layer.olLayer.setVisible(layer.visible);
      });

    this.applyZOrder();
    this.layersSubject.next(this.getLayersForPlanet(this.currentPlanet));
  }

  private addMarsBuiltInLayers() {
    const geojsonPath = 'assets/layers/surface_ice_mars.geojson';
    this.beginLoad('Loading Mars surface ice...');
    this.http.get(geojsonPath, { responseType: 'text' }).subscribe({
      next: content => {
        const features = new GeoJSON().readFeatures(content, {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857'
        });
        this.createLayer({ planet: 'mars', name: 'Surface Ice', features, geometryType: 'polygon', color: '#00ffff', shape: 'none' });
        this.refreshLayersForPlanet('mars');
        this.endLoad();
      },
      error: () => this.endLoad()
    });
  }

  private generateLayerId(layer: LayerConfig, planet: Planet, isTemporary?: boolean): string {
    if (!isTemporary) {
      return `${planet}:${layer.name.replace(/\s+/g, '_')}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    }
    return `tmp:${planet}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  }

  createLayer(params: {
    planet: Planet;
    name?: string;
    features?: FeatureLike[];
    shape?: ShapeType;
    color?: string;
    id?: string;
    cache?: boolean;
    isTemporary?: boolean;
    styleFn?: (f: FeatureLike) => Style | Style[];
    geometryType?: GeometryType;
  }): LayerConfig {
    const { planet, name: incomingName, features = [], shape, color, id, cache = true, isTemporary = false, styleFn, geometryType } = params;

    const allocation = !shape || !color ? this.styleService.allocateLayerStyle(planet) : { shape, color };
    const finalShape = shape || allocation.shape;
    const finalColor = color || allocation.color;
    const layerFeatures: Feature[] = features
      .filter((f): f is Feature => f instanceof Feature)
      .map(f => this.cloneFeature(f, { shape: finalShape }));

    const resolvedName = incomingName ? this.resolveLayerName(planet, incomingName) : `Layer_${Date.now()}`;

    const layerConfig = this.layerFactory(planet, {
      name: resolvedName,
      features: layerFeatures,
      shape: finalShape,
      color: finalColor,
      styleFn,
      isTemporary,
      geometryType,
    });

    layerConfig.id = id || this.generateLayerId(layerConfig, planet, isTemporary);
    if (!this.registry.has(layerConfig.id)) {
      this.registry.set(layerConfig.id, layerConfig);
      if (cache && !isTemporary) this.planetCache[planet].unshift(layerConfig);
      this.dragOrder.unshift(layerConfig);
      if (this._map) this._map.addLayer(layerConfig.olLayer);
      this.updateStyle(layerConfig);
      this.applyZOrder();
      this.refreshLayersForPlanet(planet);
    }
    return this.registry.get(layerConfig.id)!;
  }

  addManualLayer(
    planet: Planet,
    name: string,
    description: string,
    fileContent?: string,
    sourceType: 'CSV' | 'GeoJSON' = 'CSV',
    latField?: string,
    lonField?: string,
    id?: string
  ): LayerConfig | undefined {
    const features: Feature[] = [];

    if (fileContent) {
      if (sourceType === 'CSV') {
        const parsed = Papa.parse(fileContent, { header: true, skipEmptyLines: true });
        parsed.data.forEach((row: any) => {
          const lat = parseFloat(row[latField || 'latitude']);
          const lon = parseFloat(row[lonField || 'longitude']);
          if (!isNaN(lat) && !isNaN(lon)) {
            const f = new Feature(new Point(fromLonLat([lon, lat])));
            f.set('featureType', 'point');
            features.push(f);
          }
        });
      } else {
        const geoFeatures = new GeoJSON().readFeatures(fileContent, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' });
        geoFeatures.forEach(f => { if (f instanceof Feature) features.push(f); });
      }
    }

    const layer = this.createLayer({ planet, name, features, id });
    this.refreshLayersForPlanet(planet);
    return layer;
  }

  updateStyle(layer: LayerConfig) {
    if (!(layer.olLayer instanceof VectorLayer)) return;

    layer.features?.forEach(f => f.set('shape', layer.shape));

    layer.olLayer.setStyle((feature: FeatureLike): Style | Style[] => {
      const feat = feature as Feature;
      const fType = feat.get('featureType');
      const text = feat.get('text');

      if (fType === 'label') {
        return [
          this.styleService.getLayerStyle({
            type: 'label',
            text,
            baseColor: layer.color
          })
        ];
      }

      if (fType === 'vertex' || fType === 'point' || fType === 'pointerVertex') {
        return [
          this.styleService.getLayerStyle({
            type: 'point',
            baseColor: layer.color,
            shape: layer.shape
          })
        ];
      }

      if (fType === 'line') {
        return [
          this.styleService.getLayerStyle({
            type: 'line',
            baseColor: layer.color
          })
        ];
      }

      if (fType === 'polygon') {
        return [
          this.styleService.getLayerStyle({
            type: 'polygon',
            baseColor: layer.color
          })
        ];
      }

      return [
        this.styleService.getLayerStyle({
          type: 'point',
          baseColor: layer.color,
          shape: layer.shape
        })
      ];
    });
    layer.olLayer.changed();
  }

  remove(layer?: LayerConfig) {
    if (!layer || !this._map) return;

    this._map.removeLayer(layer.olLayer);
    this.registry.delete(layer.id);
    this.dragOrder = this.dragOrder.filter(l => l.id !== layer.id);

    Object.keys(this.planetCache).forEach(p => {
      this.planetCache[p as Planet] = this.planetCache[p as Planet].filter(l => l.id !== layer.id);
    });

    this.refreshLayersForPlanet(this.currentPlanet);
  }

  toggle(layer: LayerConfig) {
    layer.visible = !layer.visible;
    layer.olLayer.setVisible(layer.visible);
  }

  reorderLayers(sidebarOrder: LayerConfig[]) {
    sidebarOrder.slice().reverse().forEach((cfg, idx) => cfg.olLayer.setZIndex(idx + 1));
    this.dragOrder.filter(l => l.isBasemap).forEach(l => l.olLayer.setZIndex(0));
  }

  private createBasemap(planet: Planet): LayerConfig {
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
      isBasemap: true
    };

    this.basemapRegistry[planet] = config;
    return config;
  }

  applyZOrder() {
    const nonBasemap = this.dragOrder.filter(l => !l.isBasemap);
    nonBasemap.slice().reverse().forEach((layer, idx) => layer.olLayer.setZIndex(idx + 1));
    this.dragOrder.filter(l => l.isBasemap).forEach(l => l.olLayer.setZIndex(0));
  }

  private sanitizeLayerName(name: string): string {
    return name.trim().replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '');
  }

  private ensureUniqueName(planet: Planet, baseName: string): string {
    const existing = this.planetCache[planet].map(l => l.name);
    if (!existing.includes(baseName)) return baseName;

    let counter = 2;
    let candidate = `${baseName}_${counter}`;
    while (existing.includes(candidate)) {
      counter++;
      candidate = `${baseName}_${counter}`;
    }
    return candidate;
  }

  public resolveLayerName(planet: Planet, preferredName: string): string {
    const cleaned = this.sanitizeLayerName(preferredName);
    return this.ensureUniqueName(planet, cleaned);
  }

  cloneFeature(f: Feature, overrides: Record<string, any> = {}): Feature {
    const clone = f.clone();
    f.getKeys().forEach(key => clone.set(key, f.get(key)));
    Object.keys(overrides).forEach(key => clone.set(key, overrides[key]));
    if (!clone.getId()) clone.setId(crypto.randomUUID());
    return clone;
  }
}