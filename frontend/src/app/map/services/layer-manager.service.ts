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

type Planet = 'earth' | 'moon' | 'mars';

@Injectable({ providedIn: 'root' })
export class LayerManagerService {
  public styleService = inject(StyleService);
  private http = inject(HttpClient);

  private _map?: OlMap;
  currentPlanet: Planet = 'earth';

  private registry = new Map<string, LayerConfig>();
  planetCache: Record<Planet, LayerConfig[]> = { earth: [], moon: [], mars: [] };

  private basemapRegistry: Record<Planet, LayerConfig> = { earth: null!, moon: null!, mars: null! };
  private planetInitialized: Record<Planet, boolean> = { earth: false, moon: false, mars: false };

  dragOrder: LayerConfig[] = [];
  private layerFactory: LayerFactory;

  private layersSubject = new BehaviorSubject<LayerConfig[]>([]);
  layers$ = this.layersSubject.asObservable();

  constructor() {
    this.layerFactory = createVectorLayerFactory(this.styleService);
  }

  attachMap(map: OlMap) {
    this._map = map;
  }

  getLayersForPlanet(planet: Planet): LayerConfig[] {
    return this.planetCache[planet].slice();
  }

  private initializePlanet(planet: Planet) {
    if (this.planetInitialized[planet]) return;

    if (planet === 'earth') {
      this.http.get(FIRMS_CSV_URL, { responseType: 'text' }).subscribe(csv => {
        this.addManualLayer('earth', 'FIRMS Fires', 'FIRMS CSV', csv, 'CSV', 'latitude', 'longitude', 'system-firms');
      });
      this.http.get(EARTHQUAKE_GEOJSON_URL, { responseType: 'text' }).subscribe(g => {
        this.addManualLayer('earth', 'Earthquakes', 'USGS Earthquakes', g, 'GeoJSON', undefined, undefined, 'system-earthquakes');
      });
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

  private generateLayerId(layer: LayerConfig, planet: Planet, isTemporary?: boolean): string {
    if (!isTemporary) {
      return `${planet}:${layer.name.replace(/\s+/g, '_')}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    } else {
      return `tmp:${planet}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    }
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
    const {
      planet,
      name: incomingName,
      features = [],
      shape,
      color,
      id,
      cache = true,
      isTemporary = false,
      styleFn,
      geometryType,
    } = params;

    const defaultName = incomingName || (() => {
      const now = new Date();
      const MM = String(now.getMonth() + 1).padStart(2, '0');
      const DD = String(now.getDate()).padStart(2, '0');
      const HH = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      return `layer-${MM}${DD}${HH}${mm}${ss}`;
    })();

    const layerName = incomingName || defaultName;

    const layerFeatures: Feature[] = features
      .filter(f => f instanceof Feature)
      .map(f => {
        const clone = f.clone();
        const fType = f.get('featureType');
        const text = f.get('text');
        const parentId = f.get('parentFeatureId');

        clone.set('featureType', fType);
        if (text) clone.set('text', text);
        if (parentId) clone.set('parentFeatureId', parentId); // preserve line link

        if (['point', 'vertex'].includes(fType)) {
          const symbolShape = shape || this.styleService.getRandomShape();
          clone.set('shape', symbolShape);
        }

        return clone;
      });

    const layerShape: ShapeType = shape || this.styleService.getRandomShape();

    const layerConfig = this.layerFactory(planet, {
      name: layerName,
      features: layerFeatures,
      shape: layerShape,
      color,
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
      this.layersSubject.next(this.getLayersForPlanet(this.currentPlanet));
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
            const coords = fromLonLat([lon, lat]);
            const f = new Feature(new Point(coords));
            f.set('featureType', 'point');
            f.set('shape', this.styleService.getRandomShape());
            features.push(f);
          }
        });
      } else {
        const geoFeatures = new GeoJSON().readFeatures(fileContent, {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857',
        });
        geoFeatures.forEach(f => {
          if (f instanceof Feature) {
            const fType = f.get('featureType') || 'point';
            f.set('featureType', fType);
            if (fType === 'point' || fType === 'vertex') {
              f.set('shape', this.styleService.getRandomShape());
            }
            features.push(f);
          }
        });
      }
    }

    return this.createLayer({ planet, name, features, id });
  }

  updateStyle(layer: LayerConfig) {
    if (!(layer.olLayer instanceof VectorLayer)) return;

    layer.features?.forEach(f => {
      const fType = f.get('featureType');
      if (fType === 'point' || fType === 'vertex') {
        f.set('shape', layer.shape);
      }
    });

    layer.olLayer.setStyle((feature: FeatureLike): Style | Style[] => {
      const feat = feature as Feature;
      const fType = feat.get('featureType') as string | undefined;
      const text = feat.get('text');

      if (fType === 'label') {
        return [this.styleService.getLayerStyle({
          type: 'label',
          text,
          baseColor: layer.color,
          layerId: layer.id,
        })];
      }

      switch (layer.geometryType) {
        case 'line': {
          return [this.styleService.getLayerStyle({ type: 'line', baseColor: layer.color })];
        }
        case 'polygon': {
          return [this.styleService.getLayerStyle({ type: 'polygon', baseColor: layer.color })];
        }
        default: {
          const symbolShape =
            fType === 'point' || fType === 'vertex'
              ? (feat.get('shape') as ShapeType) || layer.shape
              : undefined;
          return [this.styleService.getLayerStyle({ type: 'point', baseColor: layer.color, shape: symbolShape })];
        }
      }
    });

    layer.olLayer.changed();
  }

  remove(layer?: LayerConfig) {
    if (!layer || !this._map) return;

    this._map.removeLayer(layer.olLayer);
    this.registry.delete(layer.id);
    this.dragOrder = this.dragOrder.filter(l => l.id !== layer.id);

    Object.keys(this.planetCache).forEach(p => {
      this.planetCache[p as Planet] =
        this.planetCache[p as Planet].filter(l => l.id !== layer.id);
    });

    this.layersSubject.next(this.getLayersForPlanet(this.currentPlanet));
  }

  toggle(layer: LayerConfig) {
    layer.visible = !layer.visible;
    if (layer.olLayer) {
      layer.olLayer.setVisible(layer.visible);
    }
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
      isBasemap: true,
    };

    this.basemapRegistry[planet] = config;
    return config;
  }

  applyZOrder() {
    if (!this._map) return;

    const nonBasemap = this.dragOrder.filter(l => !l.isBasemap);
    nonBasemap.slice().reverse().forEach((layer, idx) => {
      layer.olLayer.setZIndex(idx + 1);
    });

    this.dragOrder.filter(l => l.isBasemap).forEach(l => l.olLayer.setZIndex(0));
  }
}