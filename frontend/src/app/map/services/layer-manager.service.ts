import { Injectable, inject } from '@angular/core';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import VectorLayer from 'ol/layer/Vector';
import VectorImageLayer from 'ol/layer/VectorImage';
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
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();
  private messageSubject = new BehaviorSubject<string>('Loading...');
  public loadingMessage$ = this.messageSubject.asObservable();

  constructor() {
    this.layerFactory = createVectorLayerFactory(this.styleService);
  }

  attachMap(map: OlMap) { this._map = map; }

  /** API for Plugins to trigger loading spinner */
  public startExternalLoad(msg: string) { this.beginLoad(msg); }
  
  public endExternalLoad(delay: number = 3000) {
    this.activeLoads = Math.max(0, this.activeLoads - 1);
    
    if (this.activeLoads === 0) {
      this.messageSubject.next('Success!');
      
      setTimeout(() => {
        if (this.activeLoads === 0) {
          this.loadingSubject.next(false);
          this.messageSubject.next('');
        }
      }, delay);
    }
    this.applyZOrder();
  }

  private beginLoad(msg: string) {
    this.activeLoads++;
    this.messageSubject.next(msg);
    if (this.activeLoads === 1) this.loadingSubject.next(true);
  }

  private endLoad() {
    this.activeLoads = Math.max(0, this.activeLoads - 1);
    if (this.activeLoads === 0) {
      this.loadingSubject.next(false);
      this.messageSubject.next('');
    }
    this.applyZOrder();
  }

  /** Unified Loader for CSV/GeoJSON/URLs */
  public async loadVectorLayer(params: {
    planet: Planet,
    name: string,
    dataOrUrl: string,
    format: 'CSV' | 'GeoJSON',
    isUrl?: boolean
  }): Promise<LayerConfig> {
    const { planet, name, dataOrUrl, format, isUrl = false } = params;
    this.beginLoad(`Loading ${name}...`);

    try {
      const rawData = isUrl ? await this.http.get(dataOrUrl, { responseType: 'text' }).toPromise() : dataOrUrl;
      if (!rawData) throw new Error('No data');

      const features: Feature[] = [];
      if (format === 'CSV') {
        const parsed = Papa.parse(rawData, { header: true, skipEmptyLines: true });
        parsed.data.forEach((row: any) => {
          const lat = this.findCoord(row, ['latitude', 'lat', 'y', 'latdecdeg', 'latdd']);
          const lon = this.findCoord(row, ['longitude', 'lon', 'long', 'x', 'lng', 'longdecdeg']);
          if (lat !== null && lon !== null) {
            const f = new Feature({ geometry: new Point(fromLonLat([lon, lat])) });
            f.set('featureType', 'point');
            Object.keys(row).forEach(k => f.set(k, row[k]));
            features.push(f);
          }
        });
      } else {
        const geoJsonFeatures = new GeoJSON().readFeatures(rawData, {
          dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'
        });
        geoJsonFeatures.forEach(f => {
          if (f instanceof Feature) {
            f.set('featureType', f.get('featureType') || 'point');
            features.push(f);
          }
        });
      }

      const layer = this.createLayer({
        planet, name, features,
        geometryType: features[0]?.get('featureType') === 'polygon' ? 'polygon' : 'point',
        olLayer: new VectorImageLayer({ source: new VectorSource({ features }), visible: true })
      });

      this.refreshLayersForPlanet(planet);
      return layer;
    } finally {
      this.endLoad();
    }
  }

  private findCoord(row: any, aliases: string[]): number | null {
    const key = Object.keys(row).find(k => aliases.includes(k.toLowerCase().trim()));
    return key ? parseFloat(row[key]) : null;
  }

  private async initializePlanet(planet: Planet) {
    if (this.planetInitialized[planet]) return;
    if (planet === 'earth') {
      await this.loadVectorLayer({ planet, name: 'FIRMS Fires', dataOrUrl: FIRMS_CSV_URL, format: 'CSV', isUrl: true });
      await this.loadVectorLayer({ planet, name: 'Earthquakes', dataOrUrl: EARTHQUAKE_GEOJSON_URL, format: 'GeoJSON', isUrl: true });
    }
    if (planet === 'mars') {
      await this.loadVectorLayer({ planet, name: 'Surface Ice', dataOrUrl: 'assets/layers/surface_ice_mars.geojson', format: 'GeoJSON', isUrl: true });
    }
    this.planetInitialized[planet] = true;
  }

  createLayer(params: {
    planet: Planet; name?: string; features?: FeatureLike[]; shape?: ShapeType; color?: string; id?: string;
    cache?: boolean; olLayer?: TileLayer<any> | VectorLayer<any> | VectorImageLayer;
    isTemporary?: boolean; styleFn?: (f: FeatureLike) => Style | Style[];
    geometryType?: GeometryType; isTileLayer?: boolean;
    tileUrl?: string; tileExtent?: number[];
  }): LayerConfig {
    const { planet, name: incomingName, features = [], shape, color, id, cache = true, isTemporary = false, styleFn, geometryType, olLayer, tileUrl, tileExtent } = params;

    const allocation = !shape || !color ? this.styleService.allocateLayerStyle(planet) : { shape, color };
    const finalShape = shape || allocation.shape;
    const finalColor = color || allocation.color;
    const resolvedName = incomingName ? this.resolveLayerName(planet, incomingName) : `Layer_${Date.now()}`;

    const layerFeatures = features.filter((f): f is Feature => f instanceof Feature).map(f => this.cloneFeature(f, { shape: finalShape }));
    
    const layerConfig: LayerConfig = {
      id: id || this.generateLayerId({ name: resolvedName } as LayerConfig, planet, isTemporary),
      planet, name: resolvedName, features: layerFeatures, shape: finalShape, color: finalColor,
      geometryType, isTemporary, visible: true, isBasemap: false, 
      isTileLayer: params.isTileLayer || olLayer instanceof TileLayer,
      tileUrl, tileExtent,
      olLayer: olLayer || this.layerFactory(planet, { name: resolvedName, features: layerFeatures, shape: finalShape, color: finalColor, styleFn, isTemporary, geometryType }).olLayer,
    };

    if (!this.registry.has(layerConfig.id)) {
      this.registry.set(layerConfig.id, layerConfig);
      if (cache && !isTemporary) this.planetCache[planet].unshift(layerConfig);
      this.dragOrder.unshift(layerConfig);
      if (this._map) this._map.addLayer(layerConfig.olLayer);
      if (!layerConfig.isTileLayer) this.updateStyle(layerConfig);
      this.applyZOrder();
      this.refreshLayersForPlanet(planet);
    }
    return layerConfig;
  }

  updateStyle(layer: LayerConfig) {
    if (layer.isTileLayer || !(layer.olLayer instanceof VectorLayer || layer.olLayer instanceof VectorImageLayer)) return;
    const olLayer = layer.olLayer as any;
    layer.features?.forEach(f => f.set('shape', layer.shape));
    olLayer.setStyle((f: FeatureLike) => this.styleService.getLayerStyle({
      type: f.get('featureType') || 'point', baseColor: layer.color, shape: layer.shape, text: f.get('text')
    }));
    olLayer.changed();
  }

  loadPlanet(planet: Planet) {
    if (!this._map) return;
    this.currentPlanet = planet;
    this.initializePlanet(planet);
    this._map.getLayers().clear();
    this._map.addLayer(this.createBasemap(planet).olLayer);
    this.dragOrder.filter(l => l.planet === planet && !l.isBasemap).slice().reverse().forEach(l => {
      this._map!.addLayer(l.olLayer);
      l.olLayer.setVisible(l.visible);
    });
    this.applyZOrder();
    this.layersSubject.next(this.getLayersForPlanet(this.currentPlanet));
  }

  getLayersForPlanet(p: Planet) { return this.planetCache[p].slice(); }
  private refreshLayersForPlanet(p: Planet) { if (this.currentPlanet === p) this.layersSubject.next(this.getLayersForPlanet(p)); }

  remove(layer?: LayerConfig) {
    if (!layer || !this._map) return;
    this._map.removeLayer(layer.olLayer);
    this.registry.delete(layer.id);
    this.dragOrder = this.dragOrder.filter(l => l.id !== layer.id);
    Object.keys(this.planetCache).forEach(p => this.planetCache[p as Planet] = this.planetCache[p as Planet].filter(l => l.id !== layer.id));
    this.refreshLayersForPlanet(this.currentPlanet);
  }

  toggle(layer: LayerConfig) { layer.visible = !layer.visible; layer.olLayer.setVisible(layer.visible); }

  reorderLayers(sidebarOrder: LayerConfig[]) {
    sidebarOrder.slice().reverse().forEach((cfg, idx) => cfg.olLayer.setZIndex(idx + 1));
    this.dragOrder.filter(l => l.isBasemap).forEach(l => l.olLayer.setZIndex(0));
  }

  private createBasemap(planet: Planet): LayerConfig {
    if (this.basemapRegistry[planet]) return this.basemapRegistry[planet];
    const layer = new TileLayer({ source: new XYZ({ url: BASEMAP_URLS[planet] }), zIndex: 0 });
    return this.basemapRegistry[planet] = { id: `basemap-${planet}`, geometryType: 'line', name: 'Basemap', color: '#fff', shape: 'none', visible: true, olLayer: layer, features: [], planet, isBasemap: true };
  }

  applyZOrder() {
    this.dragOrder.filter(l => !l.isBasemap).slice().reverse().forEach((l, i) => l.olLayer.setZIndex(i + 1));
    this.dragOrder.filter(l => l.isBasemap).forEach(l => l.olLayer.setZIndex(0));
  }

  private generateLayerId(l: LayerConfig, p: Planet, tmp?: boolean) { return `${tmp ? 'tmp' : p}:${l.name.replace(/\s+/g, '_')}:${Date.now()}`; }
  private sanitizeLayerName(n: string) { return n.trim().replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, ''); }
  private resolveLayerName(p: Planet, n: string) {
    let name = this.sanitizeLayerName(n), count = 2, existing = this.planetCache[p].map(l => l.name);
    while (existing.includes(name)) { name = `${this.sanitizeLayerName(n)}_${count++}`; }
    return name;
  }
  cloneFeature(f: Feature, o: Record<string, any> = {}) {
    const c = f.clone();
    f.getKeys().forEach(k => c.set(k, f.get(k)));
    Object.keys(o).forEach(k => c.set(k, o[k]));
    if (!c.getId()) c.setId(crypto.randomUUID());
    return c;
  }
}
