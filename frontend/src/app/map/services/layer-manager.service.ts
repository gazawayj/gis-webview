import { Injectable } from '@angular/core';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Map as OlMap } from 'ol';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
import { StyleService, ShapeType } from './style.service';
import { HttpClient } from '@angular/common/http';
import Papa from 'papaparse';
import GeoJSON from 'ol/format/GeoJSON';
import { BehaviorSubject } from 'rxjs';

const BASEMAP_URLS: Record<string, string> = {
  earth: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  moon: 'https://moon-gis.netlify.app/tiles/{z}/{x}/{y}.png',
  mars: 'https://mars-gis.netlify.app/tiles/{z}/{x}/{y}.png'
};

const FIRMS_CSV_URL = 'https://gis-webview.onrender.com/firms';
const EARTHQUAKE_GEOJSON_URL =
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson';

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
  private planetLayers: Record<string, LayerConfig[]> = {};

  public isLoading$ = new BehaviorSubject<boolean>(false);
  public loadingMessage$ = new BehaviorSubject<string>('');
  private _loadingLayers = new Set<string>();
  public loadingLayers$ = new BehaviorSubject<Set<string>>(new Set());

  constructor(public styleService: StyleService, private http: HttpClient) { }

  attachMap(map: OlMap) {
    this._map = map;
  }

  private setLoading(layerId: string, loading: boolean) {
    if (loading) this._loadingLayers.add(layerId);
    else this._loadingLayers.delete(layerId);

    this.loadingLayers$.next(new Set(this._loadingLayers));
    this.isLoading$.next(this._loadingLayers.size > 0);
    this.loadingMessage$.next(
      this._loadingLayers.size > 0
        ? `Loading ${[...this._loadingLayers].join(', ')}...`
        : ''
    );
  }

  // ================= PLANET LAYERS =================
  loadPlanet(planet: 'earth' | 'moon' | 'mars') {
    if (!this._map) return;

    // Remove old layers
    this.layers.forEach((l) => this._map!.removeLayer(l.olLayer));
    this.layers = [];

    // Basemap first
    const basemap = this.createBasemap(planet);
    this.layers.push(basemap);
    this._map.addLayer(basemap.olLayer);

    // Default and manual layers
    let planetLayerList: LayerConfig[];
    if (this.planetLayers[planet]) {
      planetLayerList = this.planetLayers[planet];
    } else {
      planetLayerList = this.createDefaultLayers(planet);
      this.planetLayers[planet] = planetLayerList;
    }

    planetLayerList.forEach((layer) => {
      this.layers.push(layer);
      this._map!.addLayer(layer.olLayer);
    });

    this.reorderLayers(this.layers);
  }

  createBasemap(planet: 'earth' | 'moon' | 'mars'): LayerConfig {
    const url = BASEMAP_URLS[planet] || BASEMAP_URLS['earth'];
    const olLayer = new TileLayer({ source: new XYZ({ url }), zIndex: 0 });
    return {
      id: 'basemap',
      name: 'Basemap',
      color: '#fff',
      shape: 'none',
      visible: true,
      olLayer,
      isBasemap: true
    };
  }

  createDefaultLayers(planet: string): LayerConfig[] {
    const layers: LayerConfig[] = [];

    if (planet === 'earth') {
      // FIRMS CSV
      const { color: firmsColor, shape: firmsShape } =
        this.styleService.getRandomStyleProps();
      const firmsLayer = new VectorLayer({
        source: new VectorSource(),
        style: (f) => this.styleService.getStyle(firmsColor, firmsShape)
      });
      const firmsConfig: LayerConfig = {
        id: 'FIRMS',
        name: 'FIRMS',
        color: firmsColor,
        shape: firmsShape,
        visible: true,
        olLayer: firmsLayer,
        sourceType: 'CSV',
        sourceUrl: FIRMS_CSV_URL,
        latField: 'latitude',
        lonField: 'longitude'
      };
      layers.push(firmsConfig);
      this.loadLayerFromSource(firmsConfig);

      // Earthquakes GeoJSON
      const { color: eqColor, shape: eqShape } =
        this.styleService.getRandomStyleProps();
      const eqLayer = new VectorLayer({
        source: new VectorSource(),
        style: (f) => this.styleService.getStyle(eqColor, eqShape)
      });
      const eqConfig: LayerConfig = {
        id: 'earthquakes',
        name: 'Earthquakes',
        color: eqColor,
        shape: eqShape,
        visible: true,
        olLayer: eqLayer,
        sourceType: 'GeoJSON',
        sourceUrl: EARTHQUAKE_GEOJSON_URL
      };
      layers.push(eqConfig);
      this.loadLayerFromSource(eqConfig);
    }

    return layers;
  }

  // ================= NEW: GENERALIZED LAYER LOADING =================
  loadLayerFromSource(layer: LayerConfig, fileContent?: string) {
    if (!this._map) return;
    if (!(layer.olLayer instanceof VectorLayer)) return;

    const source = layer.olLayer.getSource();
    if (!source) return;

    this.setLoading(layer.id, true);

    const processCSV = (csvText: string) => {
      source.clear();
      const parsed = Papa.parse<any>(csvText, { header: true, skipEmptyLines: true });
      parsed.data.forEach((row) => {
        const lat = parseFloat(row[layer.latField || 'latitude']);
        const lon = parseFloat(row[layer.lonField || 'longitude']);
        if (!isNaN(lat) && !isNaN(lon)) {
          source.addFeature(new Feature(new Point(fromLonLat([lon, lat]))));
        }
      });
      this.setLoading(layer.id, false);
    };

    const processGeoJSON = (geojsonData: any) => {
      source.clear();
      try {
        const features = new GeoJSON().readFeatures(geojsonData, {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857'
        });
        if (features.length) source.addFeatures(features);
      } catch (err) {
        console.error(`Failed to parse GeoJSON for layer ${layer.name}:`, err);
      } finally {
        this.setLoading(layer.id, false);
      }
    };

    if (layer.sourceType === 'CSV') {
      if (fileContent) processCSV(fileContent);
      else if (layer.sourceUrl) {
        this.http.get(layer.sourceUrl, { responseType: 'text' }).subscribe({
          next: processCSV,
          error: (err) => {
            console.error(`CSV load error for ${layer.name}:`, err);
            this.setLoading(layer.id, false);
          }
        });
      }
    } else if (layer.sourceType === 'GeoJSON') {
      if (fileContent) processGeoJSON(fileContent);
      else if (layer.sourceUrl) {
        this.http.get(layer.sourceUrl).subscribe({
          next: processGeoJSON,
          error: (err) => {
            console.error(`GeoJSON load error for ${layer.name}:`, err);
            this.setLoading(layer.id, false);
          }
        });
      }
    } else {
      this.setLoading(layer.id, false);
    }
  }

  addManualLayer(
    planet: 'earth' | 'moon' | 'mars',
    name: string,
    description: string,
    fileContent?: string,
    sourceType?: 'CSV' | 'GeoJSON',
    latField?: string,
    lonField?: string
  ) {
    if (!this._map) return;

    // Prevent duplicate names for same planet
    if (!this.planetLayers[planet]) this.planetLayers[planet] = [];
    const exists = this.planetLayers[planet].some(l => l.name === name);
    if (exists) return;

    const { color, shape } = this.styleService.getRandomStyleProps();
    const olLayer = new VectorLayer({
      source: new VectorSource(),
      style: (f) => this.styleService.getStyle(color, shape)
    });

    const layer: LayerConfig = {
      id: `${name}-${Date.now()}`,
      name,
      description,
      color,
      shape,
      visible: true,
      olLayer,
      sourceType,
      latField,
      lonField
    };

    // Add to planet dictionary
    this.planetLayers[planet].push(layer);

    // Add to map and master layers array
    this.layers.push(layer);
    this._map.addLayer(olLayer);

    if (fileContent && sourceType) {
      this.loadLayerFromSource(layer, fileContent);
    }

    this.reorderLayers(this.layers);
  }

  toggle(layer: LayerConfig) {
    layer.visible = !layer.visible;
    layer.olLayer.setVisible(layer.visible);
  }

  remove(layer: LayerConfig) {
    if (!this._map) return;
    this._map.removeLayer(layer.olLayer);
    this.layers = this.layers.filter(l => l.id !== layer.id);
    Object.keys(this.planetLayers).forEach((planet) => {
      this.planetLayers[planet] = this.planetLayers[planet].filter(l => l.id !== layer.id);
    });
  }

  updateStyle(layer: LayerConfig) {
    if (!(layer.olLayer instanceof VectorLayer)) return;
    layer.olLayer.setStyle(this.styleService.getStyle(layer.color, layer.shape));
  }

  reorderLayers(sidebarLayers: LayerConfig[]) {
    const basemap = this.layers.find(l => l.isBasemap);
    let z = 1;
    sidebarLayers.forEach(layer => {
      layer.olLayer.setZIndex?.(z);
      z++;
    });
    if (basemap) basemap.olLayer.setZIndex(0);
    this.layers = basemap ? [basemap, ...sidebarLayers] : [...sidebarLayers];
  }

  persistCurrentOrder(planet: 'earth' | 'moon' | 'mars') {
    this.planetLayers[planet] = this.layers.filter(l => !l.isBasemap);
  }

  addLayerFromConsole(
    planet: 'earth' | 'moon' | 'mars',
    consoleInput: string
  ) {
    try {
      const featuresArray = JSON.parse(consoleInput);
      if (!Array.isArray(featuresArray))
        throw new Error('Console input must be array of {lon, lat}');

      const { color, shape } = this.styleService.getRandomStyleProps();
      const olLayer = new VectorLayer({
        source: new VectorSource(),
        style: (f) => this.styleService.getStyle(color, shape)
      });

      const layer: LayerConfig = {
        id: `console-${Date.now()}`,
        name: `Console Layer`,
        color,
        shape,
        visible: true,
        olLayer
      };

      const source = olLayer.getSource();
      featuresArray.forEach((pt) => {
        if (typeof pt.lon === 'number' && typeof pt.lat === 'number') {
          source?.addFeature(new Feature(new Point(fromLonLat([pt.lon, pt.lat]))));
        }
      });

      // Add to planet dictionary
      if (!this.planetLayers[planet]) this.planetLayers[planet] = [];
      this.planetLayers[planet].push(layer);

      // Add to map and master layers array
      this.layers.push(layer);
      this._map?.addLayer(olLayer);
      this.reorderLayers(this.layers);
    } catch (err) {
      console.error('Failed to parse console input:', err);
    }
  }

}

export type { ShapeType };
