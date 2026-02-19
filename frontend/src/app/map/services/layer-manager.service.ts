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
import { BehaviorSubject } from 'rxjs';
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
  private planetLayers: Record<string, LayerConfig[]> = {};

  public isLoading$ = new BehaviorSubject<boolean>(false);
  public loadingMessage$ = new BehaviorSubject<string>('');
  private _loadingLayers = new Set<string>();
  public loadingLayers$ = new BehaviorSubject<Set<string>>(new Set());

  constructor(public styleService: StyleService, private http: HttpClient) { }

  attachMap(map: OlMap) {
    this._map = map;
  }

  // ================= PLANET LOADING =================
  loadPlanet(planet: 'earth' | 'moon' | 'mars') {
    if (!this._map) return;

    this.layers.forEach(l => this._map!.removeLayer(l.olLayer));
    this.layers = [];

    const basemap = this.createBasemap(planet);
    this.layers.push(basemap);
    this._map.addLayer(basemap.olLayer);

    if (!this.planetLayers[planet]) {
      this.planetLayers[planet] = this.createDefaultLayers(planet);
    }

    this.planetLayers[planet].forEach(layer => {
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
      const { color, shape } = this.styleService.getRandomStyleProps();
      const firmsLayer = new VectorLayer({
        source: new VectorSource(),
        style: () => this.styleService.getStyle(color, shape)
      });

      const firmsConfig: LayerConfig = {
        id: 'FIRMS',
        name: 'FIRMS',
        color,
        shape,
        visible: true,
        olLayer: firmsLayer,
        sourceType: 'CSV',
        sourceUrl: FIRMS_CSV_URL,
        latField: 'latitude',
        lonField: 'longitude'
      };
      layers.push(firmsConfig);
      this.loadLayerFromSource(firmsConfig);

      const { color: eqColor, shape: eqShape } = this.styleService.getRandomStyleProps();
      const eqLayer = new VectorLayer({
        source: new VectorSource(),
        style: () => this.styleService.getStyle(eqColor, eqShape)
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

  // ================= DATA LOADING =================
  loadFIRMSLayer(layer: LayerConfig, fileContent?: string) {
    this.loadLayerFromSource(layer, fileContent);
  }

  loadLayerFromSource(layer: LayerConfig, fileContent?: string): boolean {
    if (!(layer.olLayer instanceof VectorLayer)) return false;
    if (!this._map) return false;

    const source = layer.olLayer.getSource();
    if (!source) return false;

    source.clear();
    this.setLoading(layer.id, true);

    const finish = () => this.setLoading(layer.id, false);

    const processCSV = (csvText: string): boolean => {
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
      if (!parsed.data.length) return false;

      const headers = Object.keys(parsed.data[0]).map(h => h.toLowerCase());
      const latCandidates = ['latitude', 'lat', 'y', 'ycoord', 'y_coord', 'ycoordinate'];
      const lonCandidates = ['longitude', 'lon', 'lng', 'long', 'x', 'xcoord', 'x_coord', 'xcoordinate'];
      const latField = layer.latField || headers.find(h => latCandidates.includes(h));
      const lonField = layer.lonField || headers.find(h => lonCandidates.includes(h));
      if (!latField || !lonField) return false;

      let validCount = 0;
      parsed.data.forEach((row: any) => {
        const lat = parseFloat(row[latField]);
        const lon = parseFloat(row[lonField]);
        if (!isNaN(lat) && !isNaN(lon)) {
          source.addFeature(new Feature(new Point(fromLonLat([lon, lat]))));
          validCount++;
        }
      });
      return validCount > 0;
    };

    const processGeoJSON = (geojsonData: any): boolean => {
      try {
        const geojson = typeof geojsonData === 'string' ? JSON.parse(geojsonData) : geojsonData;
        if (!geojson?.features?.length) return false;
        const features = new GeoJSON().readFeatures(geojson, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' });
        if (!features.length) return false;
        source.addFeatures(features);
        return true;
      } catch (err) {
        console.warn(`GeoJSON rejected: ${err}`);
        return false;
      }
    };

    // ================= FILE CONTENT PATH =================
    if (fileContent && fileContent.trim()) {
      const success = layer.sourceType === 'CSV' ? processCSV(fileContent) : processGeoJSON(fileContent);
      finish();
      return success;
    }

    // ================= URL FETCH PATH =================
    if (layer.sourceUrl) {
      if (layer.sourceType === 'CSV') {
        this.http.get(layer.sourceUrl, { responseType: 'text' }).subscribe({
          next: text => processCSV(text),
          error: err => console.warn(`CSV load error: ${err}`),
          complete: finish
        });
      } else if (layer.sourceType === 'GeoJSON') {
        this.http.get(layer.sourceUrl).subscribe({
          next: geo => processGeoJSON(geo),
          error: err => console.warn(`GeoJSON load error: ${err}`),
          complete: finish
        });
      }
      return true;
    }

    finish();
    return false;
  }

  // ================= MANUAL LAYER =================
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
    if (!fileContent?.trim()) {
      console.warn('Import aborted: empty file');
      return;
    }

    const { color, shape } = this.styleService.getRandomStyleProps();
    const vectorLayer = new VectorLayer({ source: new VectorSource(), style: () => this.styleService.getStyle(color, shape) });
    const config: LayerConfig = { id: `manual-${Date.now()}`, name, description, color, shape, visible: true, olLayer: vectorLayer, sourceType, latField, lonField };

    const success = this.loadLayerFromSource(config, fileContent);
    if (!success) { console.warn('Import rejected: no valid features'); return; }

    this._map.addLayer(vectorLayer);
    if (!this.planetLayers[planet]) this.planetLayers[planet] = [];
    this.planetLayers[planet].push(config);
    this.layers.push(config);
    this.reorderLayers(this.layers);
  }

  addLayerFromConsole(planet: 'earth' | 'moon' | 'mars', consoleInput: string) {
    if (!consoleInput.trim()) return;

    const url = consoleInput.trim();
    const type: 'CSV' | 'GeoJSON' = url.toLowerCase().endsWith('.geojson') ? 'GeoJSON' : 'CSV';
    const name = url.split('/').pop() || 'Console Layer';

    // Add manually, initially with no content
    this.addManualLayer(planet, name, 'Added from console', undefined, type);
    const layer = this.layers[this.layers.length - 1];
    layer.sourceUrl = url;
    this.loadLayerFromSource(layer);
  }

  // ================= UI FUNCTIONS =================
  toggle(layer: LayerConfig) {
    layer.visible = !layer.visible;
    layer.olLayer.setVisible(layer.visible);
  }

  remove(layer: LayerConfig) {
    if (!this._map) return;
    this._map.removeLayer(layer.olLayer);
    this.layers = this.layers.filter(l => l.id !== layer.id);
    Object.keys(this.planetLayers).forEach(p => {
      this.planetLayers[p] = this.planetLayers[p].filter(l => l.id !== layer.id);
    });
  }

  updateStyle(layer: LayerConfig) {
    if (!(layer.olLayer instanceof VectorLayer)) return;
    layer.olLayer.setStyle(() => this.styleService.getStyle(layer.color, layer.shape));
  }

  reorderLayers(sidebarLayers: LayerConfig[]) {
    if (!this._map) return;

    const basemap = this.layers.find(l => l.isBasemap);
    const ordered = basemap ? [basemap, ...sidebarLayers.filter(l => !l.isBasemap)] : [...sidebarLayers];
    this.layers = ordered;

    let z = 0;
    this.layers.forEach(l => l.olLayer.setZIndex(z++));
  }

  private setLoading(layerId: string, loading: boolean) {
    if (loading) this._loadingLayers.add(layerId);
    else this._loadingLayers.delete(layerId);
    this.loadingLayers$.next(new Set(this._loadingLayers));
    this.isLoading$.next(this._loadingLayers.size > 0);
  }
}

export type { ShapeType };
