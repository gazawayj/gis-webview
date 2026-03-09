import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import Papa from 'papaparse';

import { Map as OlMap } from 'ol';
import Feature, { FeatureLike } from 'ol/Feature';
import GeoJSON from 'ol/format/GeoJSON';
import Point from 'ol/geom/Point';
import { Polygon, MultiPolygon, LineString } from 'ol/geom';
import { fromLonLat, toLonLat } from 'ol/proj';
import VectorLayer from 'ol/layer/Vector';
import VectorImageLayer from 'ol/layer/VectorImage';
import TileLayer from 'ol/layer/Tile';
import VectorSource from 'ol/source/Vector';
import XYZ from 'ol/source/XYZ';
import { Style } from 'ol/style';

import { GeometryType, LayerConfig } from '../models/layer-config.model';
import { BASEMAP_URLS, EARTHQUAKE_GEOJSON_URL } from '../constants/map-constants';
import { StyleService } from './style.service';
import { ShapeType } from '../constants/symbol-constants';
import { createVectorLayerFactory, LayerFactory } from '../factories/layer.factory';
import { formatAreaPerimeter } from '../utils/map-utils';
import { KDTree } from '../utils/map-utils';

type Planet = 'earth' | 'moon' | 'mars';

@Injectable({ providedIn: 'root' })
export class LayerManagerService {

  public styleService = inject(StyleService);
  private http = inject(HttpClient);

  private _map?: OlMap;

  currentPlanet!: Planet;
  private intendedPlanet: Planet | null = null;

  private registry = new Map<string, LayerConfig>();
  planetCache: Record<Planet, LayerConfig[]> = { earth: [], moon: [], mars: [] };
  private basemapRegistry: Record<Planet, LayerConfig | null> = { earth: null, moon: null, mars: null };
  private planetInitialized: Record<Planet, boolean> = { earth: false, moon: false, mars: false };

  dragOrder: LayerConfig[] = [];
  private layerFactory: LayerFactory;

  private layersSubject = new BehaviorSubject<LayerConfig[]>([]);
  layers$ = this.layersSubject.asObservable();

  private previousHoverFeature: Feature | null = null;
  private hoverFeatureSubject = new BehaviorSubject<Feature | null>(null);
  hoverFeature$ = this.hoverFeatureSubject.asObservable();

  private activeLoads = 0;
  private spinnerMessage: string | null = null;
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();
  private messageSubject = new BehaviorSubject<string>('Loading...');
  public loadingMessage$ = this.messageSubject.asObservable();

  private subdivisionColor$ = new BehaviorSubject<string>('#271804');

  constructor() {
    this.layerFactory = createVectorLayerFactory(this.styleService);
  }

  attachMap(map: OlMap) {
    this._map = map;
  }

  startExternalLoad(message?: string) { this.beginLoad(message || 'Loading...'); }
  endExternalLoad() { this.endLoad(); }

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
  }

  applyHoverStyle(feature: Feature | null): void {
    if (!feature) return;

    if (this.previousHoverFeature && this.previousHoverFeature !== feature) {
      this.resetFeatureStyle(this.previousHoverFeature);
    }

    const layer = this.getLayerForFeature(feature);
    if (!layer) return;

    const baseColor = feature.get('color') || layer.color || '#888888';
    feature.set('hoverColor', this.styleService.brightenHex(baseColor, 2.5));

    layer.olLayer.changed();
    this._map?.renderSync();

    this.previousHoverFeature = feature;
    this.hoverFeatureSubject.next(feature);
  }

  resetFeatureStyle(feature: Feature | null): void {
    if (!feature) return;

    feature.set('hoverColor', null);

    const layer = this.getLayerForFeature(feature);
    if (layer?.olLayer) {
      layer.olLayer.changed();
      this._map?.renderSync();
    }

    if (this.previousHoverFeature === feature) {
      this.previousHoverFeature = null;
      this.hoverFeatureSubject.next(null);
    }
  }

  getLayerForFeature(feature: Feature): LayerConfig | undefined {
    return this.registry.get(feature.get('layerId'));
  }

  public loadGeoJSONLayer(params: {
    planet: Planet;
    name: string;
    url: string;
    color?: string;
    useVectorImage?: boolean;
  }) {
    this.beginLoad(`Loading ${params.name}...`);
    this.http.get(params.url, { responseType: 'text' }).subscribe({
      next: content => {
        if (this.intendedPlanet !== params.planet) {
          this.endLoad();
          return;
        }

        const features = new GeoJSON().readFeatures(content, {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857'
        }) as Feature[];

        const polygonFeatures: Feature[] = [];
        const isSubdivision =
          params.name.toLowerCase().includes('subdivision') ||
          params.name.toLowerCase().includes('ice');

        features.forEach(f => {
          const geom = f.getGeometry();
          if (!geom) return;

          const type = geom.getType();

          if (type === 'Point' || type === 'MultiPoint') {
            f.set('featureType', 'point');
          } else if (type === 'LineString' || type === 'MultiLineString') {
            f.set('featureType', 'line');
          } else if (type === 'Polygon' || type === 'MultiPolygon') {
            f.set('featureType', 'polygon');
            polygonFeatures.push(f);

            const areaM2 = (geom as Polygon | MultiPolygon).getArea();
            let perimeterM = 0;

            if (geom instanceof Polygon) {
              const coords = geom.getLinearRing(0)?.getCoordinates();
              if (coords) perimeterM = new LineString(coords).getLength();
            } else if (geom instanceof MultiPolygon) {
              geom.getPolygons().forEach(p => {
                const coords = p.getLinearRing(0)?.getCoordinates();
                if (coords) perimeterM += new LineString(coords).getLength();
              });
            }

            const formatted = formatAreaPerimeter(areaM2, perimeterM);
            f.set('tooltipData', {
              title: f.get('NAME') || f.get('UNIT_NAME') || 'Unknown Region',
              code: f.get('SUBCODE') || f.get('SUBDIVISION_CODE') || f.get('id') || 'N/A',
              area: formatted.area,
              perimeter: formatted.perimeter
            });
          }
        });

        const layer = this.createLayer({
          planet: params.planet,
          name: params.name,
          features: isSubdivision ? polygonFeatures : features,
          geometryType: isSubdivision ? 'polygon' : 'point',
          color: params.color || '#ffffff',
          useVectorImage: params.useVectorImage ?? true
        });

        this.refreshLayersForPlanet(params.planet);
        this.endLoad();
      },

      error: () => this.endLoad()
    });
  }

  loadPlanet(planet: Planet) {
    if (!this._map) return;
    this.currentPlanet = planet;
    this.intendedPlanet = planet;
    if (!this.planetInitialized[planet]) this.initializePlanet(planet);
    this._map.getLayers().clear();
    const basemap = this.createBasemap(planet);
    this._map.addLayer(basemap.olLayer);
    this.dragOrder.filter(l => l.planet === planet && !l.isBasemap)
      .slice().reverse()
      .forEach(layer => {
        this._map!.addLayer(layer.olLayer);
        layer.olLayer.setVisible(layer.visible);
      });
    this.applyZOrder();
    this.refreshLayersForPlanet(planet);
  }

  private initializePlanet(planet: Planet) {
    this.intendedPlanet = planet;
    const basemap = this.createBasemap(planet);
    if (this._map && !this._map.getLayers().getArray().includes(basemap.olLayer)) this._map.addLayer(basemap.olLayer);

    // Load built-in vector layers and build KD-trees automatically
    if (planet === 'earth') {
      this.loadGeoJSONLayer({
        planet: 'earth',
        name: 'Subdivisions',
        url: 'assets/layers/Subdivision.geojson',
        color: this.subdivisionColor$.value
      });
      this.http.get(EARTHQUAKE_GEOJSON_URL, { responseType: 'text' }).subscribe(g => {
        const layer = this.addManualLayer('earth', 'Earthquakes', 'USGS Earthquakes', g, 'GeoJSON', undefined, undefined, 'system-earthquakes');
        if (layer) this.buildKDTree(layer);
      });
    }

    if (planet === 'mars') {
      this.loadGeoJSONLayer({
        planet: 'mars',
        name: 'Surface Ice',
        url: 'assets/layers/surface_ice_mars.geojson',
        color: '#00ffff'
      });
    }

    this.planetInitialized[planet] = true;
  }

  createLayer(params: {
    planet: Planet;
    name?: string;
    features?: FeatureLike[];
    shape?: ShapeType;
    color?: string;
    id?: string;
    olLayer?: any;
    geometryType?: GeometryType;
    useVectorImage?: boolean;
    styleFn?: (f: FeatureLike) => Style | Style[];
    isTemporary?: boolean;
    isTileLayer?: boolean; // Required for highres plugin
    tileUrl?: string;
    tileExtent?: number[];
    cache?: boolean;
  }): LayerConfig {
    // Allocate style and shape
    const allocation = this.styleService.allocateLayerStyle(params.planet);
    const finalColor = params.color || allocation.color;
    const finalShape = params.shape || allocation.shape;

    // Resolve unique layer name
    const resolvedName = params.name ? this.resolveLayerName(params.planet, params.name) : `Layer_${Date.now()}`;
    const layerId = params.id || this.generateLayerId(resolvedName, params.planet);

    // Clone features and set layerId
    const layerFeatures: Feature[] = (params.features || [])
      .filter((f): f is Feature => f instanceof Feature)
      .map(f => {
        const cloned = this.cloneFeature(f, { shape: finalShape, layerId });
        cloned.set('layerId', layerId);
        return cloned;
      });

    let layerConfig: LayerConfig;

    // Handle tile layers
    if (params.olLayer && (params.isTileLayer || params.olLayer instanceof TileLayer)) {
      layerConfig = {
        id: layerId,
        planet: params.planet,
        name: resolvedName,
        features: layerFeatures,
        shape: finalShape,
        color: finalColor,
        geometryType: params.geometryType,
        olLayer: params.olLayer,
        visible: true,
        isBasemap: false,
        isTileLayer: true,
        tileUrl: params.tileUrl,
        tileExtent: params.tileExtent
      };
    } else {
      // Create vector layer
      const source = new VectorSource({ features: layerFeatures });
      const layer = params.useVectorImage
        ? new VectorImageLayer({ source })
        : new VectorLayer({ source, updateWhileInteracting: true, updateWhileAnimating: true });

      layerConfig = {
        id: layerId,
        planet: params.planet,
        name: resolvedName,
        features: layerFeatures,
        shape: finalShape,
        color: finalColor,
        geometryType: params.geometryType,
        olLayer: layer,
        visible: true,
        isBasemap: false,
        isTemporary: params.isTemporary || false
      };
    }

    /** ---------------- KD-Tree Construction ---------------- **/
    const kdPoints: [number, number][] = [];

    layerFeatures.forEach(f => {
      const geom = f.getGeometry();
      if (!geom) return;

      if (geom instanceof Point) {
        kdPoints.push(geom.getCoordinates() as [number, number]);

      } else if (geom instanceof Polygon) {
        // Flatten all rings of polygon
        geom.getCoordinates().forEach(ring =>
          ring.forEach(coord => kdPoints.push(coord as [number, number]))
        );

      } else if (geom instanceof MultiPolygon) {
        // Flatten all polygons and rings
        geom.getPolygons().forEach(polygon =>
          polygon.getCoordinates().forEach(ring =>
            ring.forEach(coord => kdPoints.push(coord as [number, number]))
          )
        );
      }
    });

    if (kdPoints.length > 0) {
      layerConfig.kdTree = new KDTree(kdPoints);
    }

    // --- Insert into caches ---
    this.registry.set(layerConfig.id, layerConfig);
    if (!params.isTemporary && params.cache !== false) {
      const planetLayers = this.planetCache[params.planet] || [];
      planetLayers.unshift(layerConfig);
      this.planetCache[params.planet] = planetLayers;
    }

    // Insert into dragOrder after basemaps
    const basemapCount = this.dragOrder.filter(l => l.isBasemap).length;
    this.dragOrder.splice(basemapCount, 0, layerConfig);

    // Add OL layer to map
    if (this._map) this._map.addLayer(layerConfig.olLayer);
    // Update style and z-index
    this.updateStyle(layerConfig);
    this.applyZOrder();
    // Refresh sidebar immediately
    this.refreshLayersForPlanet(params.planet);
    return layerConfig;
  }

  /** Build and cache KD-tree for fast nearest-neighbor queries */
  buildKDTree(layer: LayerConfig): void {
    if (!layer.features || layer.features.length === 0) return;

    const kdPoints: [number, number][] = [];

    layer.features.forEach(f => {
      const geom = f.getGeometry();
      if (!geom) return;

      const pushCoord = (c: [number, number]) => kdPoints.push(c);

      if (geom instanceof Point) {
        pushCoord(geom.getCoordinates() as [number, number]);

      } else if (geom instanceof Polygon) {
        geom.getCoordinates().forEach(ring =>
          ring.forEach(c => pushCoord(c as [number, number]))
        );

      } else if (geom instanceof MultiPolygon) {
        geom.getPolygons().forEach(p =>
          p.getCoordinates().forEach(ring =>
            ring.forEach(c => pushCoord(c as [number, number]))
          )
        );
      }
    });

    if (kdPoints.length > 0) {
      layer.kdTree = new KDTree(kdPoints);
    }
  }

  updateStyle(layer: LayerConfig) {
    if (layer.isTileLayer || !(layer.olLayer instanceof VectorLayer || layer.olLayer instanceof VectorImageLayer)) return;
    const vectorLayer = layer.olLayer as any;
    vectorLayer.setStyle((feature: FeatureLike): Style | Style[] => {
      const feat = feature as Feature;
      const fType = feat.get('featureType');
      const text = feat.get('text');
      const hoverColor = feat.get('hoverColor');
      const baseColor = hoverColor || layer.color;

      if (fType === 'label') return [this.styleService.getLayerStyle({ type: 'label', text, baseColor })];
      if (fType === 'polygon') return [this.styleService.getLayerStyle({ type: 'polygon', baseColor })];
      if (fType === 'line') return [this.styleService.getLayerStyle({ type: 'line', baseColor })];
      return [this.styleService.getLayerStyle({ type: 'point', baseColor, shape: layer.shape })];
    });
    vectorLayer.changed();
  }

  addManualLayer(planet: Planet, name: string, description: string, fileContent: string,
    sourceType: 'CSV' | 'GeoJSON', latField?: string, lonField?: string, id?: string): LayerConfig | undefined {
    const features: Feature[] = [];
    if (sourceType === 'CSV') {
      const parsed = Papa.parse(fileContent, { header: true, skipEmptyLines: true });
      parsed.data.forEach((row: any) => {
        const lat = parseFloat(row[latField || 'latitude']), lon = parseFloat(row[lonField || 'longitude']);
        if (!isNaN(lat) && !isNaN(lon)) {
          const f = new Feature(new Point(fromLonLat([lon, lat])));
          f.set('featureType', 'point');
          features.push(f);
        }
      });
    } else {
      const geoFeatures = new GeoJSON().readFeatures(fileContent, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857'
      });

      geoFeatures.forEach(f => {
        if (!(f instanceof Feature)) return;
        const geom = f.getGeometry();
        if (!geom) return;
        const type = geom.getType();
        if (type === 'Point' || type === 'MultiPoint') {
          f.set('featureType', 'point');
        }
        else if (type === 'LineString' || type === 'MultiLineString') {
          f.set('featureType', 'line');
        }
        else if (type === 'Polygon' || type === 'MultiPolygon') {
          f.set('featureType', 'polygon');
        }
        features.push(f);
      });
    }
    return this.createLayer({ planet, name, features, id, useVectorImage: true });
  }

  private createBasemap(planet: Planet): LayerConfig {
    if (this.basemapRegistry[planet]) return this.basemapRegistry[planet]!;
    const layer = new TileLayer({ source: new XYZ({ url: BASEMAP_URLS[planet] }), zIndex: 0 });
    const config: LayerConfig = { id: `basemap-${planet}`, name: 'Basemap', color: '#fff', shape: 'none', visible: true, olLayer: layer, features: [], planet, isBasemap: true };
    this.basemapRegistry[planet] = config;
    return config;
  }

  toggle(layer: LayerConfig) {
    layer.visible = !layer.visible;
    layer.olLayer.setVisible(layer.visible);
  }

  remove(layer: LayerConfig) {
    if (this._map) this._map.removeLayer(layer.olLayer);
    this.registry.delete(layer.id);
    this.dragOrder = this.dragOrder.filter(l => l.id !== layer.id);
    this.planetCache[layer.planet] = this.planetCache[layer.planet].filter(l => l.id !== layer.id);
    this.refreshLayersForPlanet(this.currentPlanet);
  }

  reorderLayers(sidebarOrder: LayerConfig[]) {
    sidebarOrder.slice().reverse().forEach((cfg, idx) => cfg.olLayer.setZIndex(idx + 1));
    this.dragOrder.filter(l => l.isBasemap).forEach(l => l.olLayer.setZIndex(0));
  }

  applyZOrder() {
    this.dragOrder.filter(l => l.isBasemap).forEach(l => l.olLayer.setZIndex(0));
    this.dragOrder.filter(l => !l.isBasemap).slice().reverse().forEach((l, i) => l.olLayer.setZIndex(i + 1));
  }

  private refreshLayersForPlanet(p: Planet) {
    const planetLayers = this.planetCache[p] || [];
    const basemaps = this.dragOrder.filter(l => l.isBasemap);
    const nonBasemaps = planetLayers.filter(l => !l.isBasemap);
    const ordered = [...nonBasemaps, ...basemaps];
    this.layersSubject.next(ordered);
  }

  private generateLayerId(name: string, planet: Planet): string { return `${planet}:${name}:${Date.now()}`; }
  private resolveLayerName(planet: Planet, name: string): string {
    const existing = this.planetCache[planet].map(l => l.name);
    let finalName = name, count = 1;
    while (existing.includes(finalName)) finalName = `${name}_${count++}`;
    return finalName;
  }

  cloneFeature(f: Feature, overrides: Record<string, any> = {}): Feature {
    const clone = f.clone();
    f.getKeys().forEach(key => { if (key !== 'geometry') clone.set(key, f.get(key)); });
    Object.keys(overrides).forEach(key => clone.set(key, overrides[key]));
    if (!clone.getId()) clone.setId(crypto.randomUUID());
    return clone;
  }

}