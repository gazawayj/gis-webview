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
  description?: string;
  sourceType?: 'CSV' | 'GeoJSON';
  sourceUrl?: string;
  latField?: string;
  lonField?: string;
}

@Injectable({ providedIn: 'root' })
export class LayerManagerService {
  private _map?: OlMap;
  public layers: LayerConfig[] = [];
  public currentPlanet: 'earth' | 'moon' | 'mars' = 'earth';

  private registry = new Map<string, LayerConfig>();
  private planetCache: Record<'earth' | 'moon' | 'mars', LayerConfig[]> = { earth: [], moon: [], mars: [] };
  private basemapRegistry: Record<'earth' | 'moon' | 'mars', LayerConfig> = { earth: null!, moon: null!, mars: null! };

  constructor(public styleService: StyleService, private http: HttpClient) {}

  attachMap(map: OlMap) {
    this._map = map;
  }

  /** Registers a layer to map, sidebar, and cache */
  registerLayer(config: LayerConfig, planet: 'earth' | 'moon' | 'mars') {
    if (!this._map) return;
    if (this.registry.has(config.id)) return;

    this.registry.set(config.id, config);

    if (!this.planetCache[planet].some(l => l.id === config.id)) {
      this.planetCache[planet].push(config);
    }

    if (planet === this.currentPlanet) {
      if (!this._map.getLayers().getArray().includes(config.olLayer)) {
        config.olLayer.setVisible(config.visible);
        this._map.addLayer(config.olLayer);
      }
    }

    if (!config.isBasemap && !this.layers.some(l => l.id === config.id)) {
      this.layers.push(config);
    }

    this.applyZOrder();
  }

  /** Loads all layers for a planet */
  loadPlanet(planet: 'earth'|'moon'|'mars') {
    if (!this._map) return;
    this.currentPlanet = planet;

    // Clear map
    this._map.getLayers().getArray().forEach(layer => this._map?.removeLayer(layer));

    // Clear sidebar
    this.layers = [];

    // Add basemap
    const basemap = this.createBasemap(planet);
    this._map.addLayer(basemap.olLayer);

    // Initialize built-in layers
    this.initBuiltInLayers(planet);

    // Add cached layers
    this.planetCache[planet].forEach(layer => {
      if (!this._map?.getLayers().getArray().includes(layer.olLayer)) {
        this._map?.addLayer(layer.olLayer);
      }
      if (!layer.isBasemap && !this.layers.some(l => l.id === layer.id)) this.layers.push(layer);
    });
    this.applyZOrder();
  }

  createBasemap(planet: 'earth' | 'moon' | 'mars'): LayerConfig {
    if (this.basemapRegistry[planet]) return this.basemapRegistry[planet];

    const olLayer = new TileLayer({
      source: new XYZ({ url: BASEMAP_URLS[planet] || BASEMAP_URLS['earth'] }),
      zIndex: 0,
      visible: true
    });

    const basemap: LayerConfig = {
      id: `basemap-${planet}`,
      name: 'Basemap',
      color: '#fff',
      shape: 'none',
      visible: true,
      olLayer,
      isBasemap: true
    };

    this.basemapRegistry[planet] = basemap;
    return basemap;
  }

  /** Initialize built-in layers */
  private initBuiltInLayers(planet: 'earth' | 'moon' | 'mars') {
    if (planet === 'earth') {
      this.loadFIRMSLayer();
      this.loadEarthquakeLayer();
    }
    // future moon/mars layers
  }

  /** FIRMS CSV */
  private loadFIRMSLayer() {
    if (!FIRMS_CSV_URL) return;
    this.http.get(FIRMS_CSV_URL, { responseType: 'text' }).subscribe(csvText => {
      const features: Feature[] = [];
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
      parsed.data.forEach((row: any) => {
        const lat = parseFloat(row['latitude']);
        const lon = parseFloat(row['longitude']);
        if (!isNaN(lat) && !isNaN(lon)) features.push(new Feature(new Point(fromLonLat([lon, lat]))));
      });
      if (!features.length) return;

      const color = '#ff3300';
      const shape: ShapeType = 'circle';
      const vectorLayer = new VectorLayer({
        source: new VectorSource({ features }),
        style: () => this.styleService.getStyle(color, shape)
      });

      const config: LayerConfig = {
        id: 'firms-layer',
        name: 'FIRMS Fires',
        color,
        shape,
        visible: true,
        olLayer: vectorLayer,
        sourceType: 'CSV',
        description: 'NASA FIRMS fire data'
      };

      this.registerLayer(config, 'earth');
    });
  }

  /** Earthquake GeoJSON */
  private loadEarthquakeLayer() {
    if (!EARTHQUAKE_GEOJSON_URL) return;
    this.http.get(EARTHQUAKE_GEOJSON_URL, { responseType: 'text' }).subscribe(geojsonText => {
      const features = new GeoJSON().readFeatures(geojsonText, { featureProjection: 'EPSG:3857' });
      if (!features.length) return;

      const color = '#0077ff';
      const shape: ShapeType = 'triangle';
      const vectorLayer = new VectorLayer({
        source: new VectorSource({ features }),
        style: () => this.styleService.getStyle(color, shape)
      });

      const config: LayerConfig = {
        id: 'earthquake-layer',
        name: 'Earthquakes',
        color,
        shape,
        visible: true,
        olLayer: vectorLayer,
        sourceType: 'GeoJSON',
        description: 'Recent earthquake data'
      };

      this.registerLayer(config, 'earth');
    });
  }

  /** Adds a distance measurement layer as a first-class layer */
addDistanceLayer(
  planet: 'earth' | 'moon' | 'mars',
  name: string,
  features: Feature[]
) {
  if (!this._map || !features.length) return;

  // Get a consistent color for distance layers
  const color = '#633e0f';
  const shape: ShapeType = 'line';

  // Create OL vector layer
  const vectorLayer = new VectorLayer({
    source: new VectorSource({ features: features.map(f => f.clone()) }),
    style: () => this.styleService.getStyle(color, shape)
  });

  const config: LayerConfig = {
    id: `distance-${Date.now()}`,
    name,
    color,
    shape,
    visible: true,
    olLayer: vectorLayer,
    sourceType: 'GeoJSON',        // keep as GeoJSON for compatibility
    description: 'Distance measurement layer'
  };

  // Register layer under the specified planet
  this.registerLayer(config, planet);
}

  /** Manual layer */
  addManualLayer(
    planet: 'earth' | 'moon' | 'mars',
    name: string,
    description: string,
    fileContent?: string,
    sourceType: 'CSV' | 'GeoJSON' = 'CSV',
    latField?: string,
    lonField?: string
  ) {
    if (!this._map) return;

    const { color, shape } = this.styleService.getRandomStyleProps();
    const vectorLayer = new VectorLayer({
      source: new VectorSource(),
      style: () => this.styleService.getStyle(color, shape)
    });

    const config: LayerConfig = {
      id: `manual-${Date.now()}`,
      name,
      description,
      color,
      shape,
      visible: true,
      olLayer: vectorLayer,
      sourceType,
      latField,
      lonField
    };

    if (fileContent) this.loadLayerFromSource(config, fileContent);
    this.registerLayer(config, planet);
  }

  /** Load features from CSV/GeoJSON */
  loadLayerFromSource(layer: LayerConfig, fileContent?: string): boolean {
    if (!(layer.olLayer instanceof VectorLayer)) return false;
    const source = layer.olLayer.getSource();
    if (!source) return false;
    source.clear();

    if (layer.sourceType === 'CSV' && fileContent) {
      const parsed = Papa.parse(fileContent, { header: true, skipEmptyLines: true });
      parsed.data.forEach((row: any) => {
        const lat = parseFloat(row[layer.latField || 'latitude']);
        const lon = parseFloat(row[layer.lonField || 'longitude']);
        if (!isNaN(lat) && !isNaN(lon)) source.addFeature(new Feature(new Point(fromLonLat([lon, lat]))));
      });
    } else if (layer.sourceType === 'GeoJSON' && fileContent) {
      const features = new GeoJSON().readFeatures(fileContent, { featureProjection: 'EPSG:3857' });
      source.addFeatures(features);
    }

    return source.getFeatures().length > 0;
  }

  /** Toggle layer */
  toggle(layer: LayerConfig) {
    layer.visible = !layer.visible;
    layer.olLayer.setVisible(layer.visible);
  }

  /** Remove layer */
  remove(layer: LayerConfig) {
    if (!this._map) return;
    this._map.removeLayer(layer.olLayer);
    this.registry.delete(layer.id);
    this.layers = this.layers.filter(l => l.id !== layer.id);
    Object.keys(this.planetCache).forEach(p => {
      this.planetCache[p as 'earth'|'moon'|'mars'] =
        this.planetCache[p as 'earth'|'moon'|'mars'].filter(l => l.id !== layer.id);
    });
  }

  /** Update vector style */
  updateStyle(layer: LayerConfig) {
    if (!(layer.olLayer instanceof VectorLayer)) return;
    layer.olLayer.setStyle(() => this.styleService.getStyle(layer.color, layer.shape));
  }

  /** Reorder sidebar layers */
  reorderLayers(sidebarOrder: LayerConfig[]) {
    if (!this._map) return;
    this.layers = sidebarOrder;
    this.applyZOrder();
  }

  /** Apply z-index: basemap=0, layers stacked above */
  applyZOrder() {
    if (!this._map) return;
    let z = 0;
    const basemap = this.planetCache[this.currentPlanet].find(l => l.isBasemap);
    if (basemap) basemap.olLayer.setZIndex(z++);
    this.layers.forEach(l => l.olLayer.setZIndex(z++));
  }
}
