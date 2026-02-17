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
const EARTHQUAKE_GEOJSON_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson';

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

  /** Holds already-created planet layers for persistence */
  private planetLayers: Record<string, LayerConfig[]> = {};

  public isLoading$ = new BehaviorSubject<boolean>(false);
  public loadingMessage$ = new BehaviorSubject<string>('');

  private _loadingLayers = new Set<string>();
  public loadingLayers$ = new BehaviorSubject<Set<string>>(new Set());

  constructor(private styleService: StyleService, private http: HttpClient) { }

  attachMap(map: OlMap) {
    this._map = map;
  }

  private setLoading(layerId: string, loading: boolean) {
    if (loading) this._loadingLayers.add(layerId);
    else this._loadingLayers.delete(layerId);

    this.loadingLayers$.next(new Set(this._loadingLayers));
    this.isLoading$.next(this._loadingLayers.size > 0);
    this.loadingMessage$.next(
      this._loadingLayers.size > 0 ? `Loading ${[...this._loadingLayers].join(', ')}...` : ''
    );
  }

  loadPlanet(planet: 'earth' | 'moon' | 'mars') {
    if (!this._map) return;

    // Remove old layers
    this.layers.forEach(l => this._map!.removeLayer(l.olLayer));
    this.layers = [];

    // Add basemap
    const basemap = this.createBasemap(planet);
    this.layers.push(basemap);
    this._map.addLayer(basemap.olLayer);

    // Add planet-specific layers, using persistent LayerConfig if available
    let defaultLayers: LayerConfig[];
    if (this.planetLayers[planet]) {
      defaultLayers = this.planetLayers[planet];
    } else {
      defaultLayers = this.createDefaultLayers(planet);
      this.planetLayers[planet] = defaultLayers;
    }

    defaultLayers.forEach(layer => {
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
      color: '#ffffff',
      shape: 'none',
      visible: true,
      olLayer,
      isBasemap: true
    };
  }

  createDefaultLayers(planet: string): LayerConfig[] {
    const layers: LayerConfig[] = [];

    if (planet === 'earth') {
      // FIRMS CSV layer
      const { color: firmsColor, shape: firmsShape } = this.styleService.getRandomStyleProps();
      const firmsSource = new VectorSource();
      const firmsLayer = new VectorLayer({
        source: firmsSource,
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
      this.loadCSVLayer(firmsConfig);

      // Earthquake GeoJSON layer
      const { color: eqColor, shape: eqShape } = this.styleService.getRandomStyleProps();
      const eqSource = new VectorSource({ format: new GeoJSON() });
      const eqLayer = new VectorLayer({
        source: eqSource,
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
      this.loadGeoJSONLayer(eqConfig);
    }

    return layers;
  }

  private loadCSVLayer(layer: LayerConfig) {
    if (!layer.sourceUrl || !this._map) return;

    const vl = layer.olLayer as VectorLayer<VectorSource>;
    const source = vl.getSource();
    if (!source) return;

    this.setLoading(layer.id, true);

    this.http.get(layer.sourceUrl, { responseType: 'text' }).subscribe({
      next: (csv) => {
        const parsed = Papa.parse<any>(csv, { header: true, skipEmptyLines: true });
        parsed.data.forEach((row) => {
          const lat = parseFloat(row[layer.latField || 'latitude']);
          const lon = parseFloat(row[layer.lonField || 'longitude']);
          if (!isNaN(lat) && !isNaN(lon)) {
            source.addFeature(new Feature(new Point(fromLonLat([lon, lat]))));
          }
        });
        this.setLoading(layer.id, false);
      },
      error: (err) => {
        console.error(`CSV layer load error for ${layer.name}:`, err);
        this.setLoading(layer.id, false);
      }
    });
  }

  private loadGeoJSONLayer(layer: LayerConfig) {
    if (!layer.sourceUrl || !this._map) return;

    const vl = layer.olLayer as VectorLayer<VectorSource>;
    const source = vl.getSource();
    if (!source) return;

    this.setLoading(layer.id, true);

    this.http.get(layer.sourceUrl).subscribe({
      next: (geojson: any) => {
        const features = new GeoJSON().readFeatures(geojson, { featureProjection: 'EPSG:3857' });
        if (features.length) source.addFeatures(features);
        this.setLoading(layer.id, false);
      },
      error: (err) => {
        console.error(`GeoJSON layer load error for ${layer.name}:`, err);
        this.setLoading(layer.id, false);
      }
    });
  }

  addManualLayer(planet: string, name: string, description: string) {
    if (!this._map) return;

    // Assign persistent random style
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
      olLayer
    };

    this.layers.push(layer);
    this._map.addLayer(olLayer);
    this.reorderLayers(this.layers);
  }

  toggle(layer: LayerConfig) {
    layer.visible = !layer.visible;
    layer.olLayer.setVisible(layer.visible);
  }

  remove(layer: LayerConfig) {
    if (!this._map) return;
    // Remove from map
    this._map.removeLayer(layer.olLayer);
    // Remove from active layers
    this.layers = this.layers.filter(l => l.id !== layer.id);
    // ALSO remove from persistent planet store
    Object.keys(this.planetLayers).forEach(planet => {
      this.planetLayers[planet] =
        this.planetLayers[planet].filter(l => l.id !== layer.id);
    });
  }


  updateStyle(layer: LayerConfig) {
    if (!(layer.olLayer instanceof VectorLayer)) return;
    layer.olLayer.setStyle(this.styleService.getStyle(layer.color, layer.shape));
  }

  reorderLayers(layers: LayerConfig[]) {
    layers.forEach((layer, idx) => {
      if (layer.olLayer.setZIndex) layer.olLayer.setZIndex(idx + 1);
    });
  }

  persistCurrentOrder(planet: 'earth' | 'moon' | 'mars') {
    // Store a shallow copy preserving order
    this.planetLayers[planet] = this.layers
      .filter(l => !l.isBasemap);
  }
}
export type { ShapeType };

