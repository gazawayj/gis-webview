import { Component, ElementRef, NgZone, OnInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { take } from 'rxjs';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import { toLonLat as olToLonLat } from 'ol/proj';
import { defaults as defaultControls } from 'ol/control';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import Style from 'ol/style/Style';
import CircleStyle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import Papa, { ParseResult } from 'papaparse';
import { Feature } from 'ol';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
import RegularShape from 'ol/style/RegularShape';

export type Planet = 'earth' | 'moon' | 'mars';

export interface Layer {
  name: string;
  type: 'vector' | 'raster' | 'basemap';
  source: string;
  visible: boolean;
  color?: string;
  description?: string;
  latField?: string;
  lonField?: string;
  isCSV?: boolean;
  shape?: 'circle' | 'square' | 'triangle';
}

interface PlanetStats { gravity: number; lonLabel: string; latLabel: string; }

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, HttpClientModule],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})
export class MapComponent implements OnInit {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;
  map!: Map;
  baseLayer!: TileLayer<XYZ>;
  layerMap: Record<string, VectorLayer<VectorSource>> = {};
  layers: Layer[] = [];
  layersByPlanet: Record<Planet, Layer[]> = { earth: [], moon: [], mars: [] };
  isLoading = false;
  loadingMessage = '';
  currentPlanet: Planet = 'earth';
  currentLon = 0;
  currentLat = 0;
  zoomDisplay = 2;
  currentStats: PlanetStats = { gravity: 9.81, lonLabel: 'Longitude', latLabel: 'Latitude' };
  isModalOpen = false;
  modalMode: 'manual' | 'console' = 'manual';
  newLayer: Layer = { name: '', type: 'vector', source: '', visible: true, latField: 'latitude', lonField: 'longitude' };
  terminalLines: string[] = [];
  readonly BASEMAP_URLS: Record<Planet, string> = {
    earth: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    moon: 'https://moon-gis.netlify.app/tiles/{z}/{x}/{y}.png',
    mars: 'https://mars-gis.netlify.app/tiles/{z}/{x}/{y}.png'
  };

  constructor(private ngZone: NgZone, private cdr: ChangeDetectorRef, private http: HttpClient) { }

  ngOnInit(): void {
    this.initializeMap();
    this.initializePlanetLayers();
  }

  initializePlanetLayers() {
    // FIRMS
    this.addLayerToMap({
      name: 'Current Fires (FIRMS)',
      type: 'vector',
      source: 'https://gis-webview.onrender.com/firms',
      visible: true,
      latField: 'latitude',
      lonField: 'longitude',
      isCSV: true
    });

    // USGS Earthquakes past 24h
    this.addLayerToMap({
      name: 'USGS Earthquakes (24h)',
      type: 'vector',
      source: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.csv', // example CORS-enabled CSV
      visible: false,
      latField: 'latitude',
      lonField: 'longitude'
    });
  }

  getRandomColor(): string {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) color += letters[Math.floor(Math.random() * 16)];
    return color;
  }

  addLayerToMap(layer: Layer) {
    // Push Layer into UI array if not present
    if (!this.layers.some(l => l.name === layer.name)) this.layers.push(layer);
    if (!this.layersByPlanet[this.currentPlanet].some(l => l.name === layer.name))
      this.layersByPlanet[this.currentPlanet].push(layer);

    const vectorSource = new VectorSource();
    const color = this.getRandomColor();
    layer.color = color; // store for consistent use

    const vectorLayer = new VectorLayer({
      source: vectorSource,
      visible: layer.visible,
      style: new Style({
        image: new CircleStyle({
          radius: 5,
          fill: new Fill({ color }),
          stroke: new Stroke({ color: '#000', width: 1 })
        })
      })
    });
    this.layerMap[layer.name] = vectorLayer;
    this.map.addLayer(vectorLayer);

    // Load CSV if vector
    if (layer.isCSV || layer.type === 'vector') {
      this.isLoading = true;
      this.loadingMessage = `Loading ${layer.name}...`;
      this.cdr.detectChanges();

      this.http.get(layer.source, { responseType: 'text' }).pipe(take(1)).subscribe({
        next: (csvData: string) => {
          const parsed: ParseResult<any> = Papa.parse(csvData, { header: true, skipEmptyLines: true });
          parsed.data.forEach(row => {
            const lat = parseFloat(row[layer.latField || 'latitude']);
            const lon = parseFloat(row[layer.lonField || 'longitude']);
            if (!isNaN(lat) && !isNaN(lon)) {
              const feature = new Feature({ geometry: new Point(fromLonLat([lon, lat])) });
              vectorSource.addFeature(feature);
            }
          });

          // Done loading
          this.isLoading = false;
          this.loadingMessage = '';
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          console.error(`${layer.name} CSV load error:`, err);
          this.isLoading = false;
          this.loadingMessage = '';
          this.cdr.detectChanges();
        }
      });
    }
  }


  initializeMap(): void {
    this.baseLayer = new TileLayer({ visible: true, source: new XYZ({ url: this.BASEMAP_URLS[this.currentPlanet] }) });
    const view = new View({ center: [0, 0], zoom: 2, projection: 'EPSG:3857' });
    this.map = new Map({ target: this.mapContainer.nativeElement, layers: [this.baseLayer], view, controls: defaultControls() });

    this.map.on('pointermove', (evt) => {
      const coord = evt.coordinate;
      if (!coord) return;
      this.ngZone.run(() => {
        const [lon, lat] = olToLonLat(coord);
        this.currentLon = parseFloat(lon.toFixed(6));
        this.currentLat = parseFloat(lat.toFixed(6));
        this.zoomDisplay = parseFloat((view.getZoom() ?? 2).toFixed(2));
        this.cdr.detectChanges();
      });
    });
  }

  loadCSVLayer(layer: Layer, vector: VectorLayer<VectorSource>): void {
    this.isLoading = true;
    this.loadingMessage = `Loading ${layer.name}...`;

    this.http.get(layer.source, { responseType: 'text' }).pipe(take(1)).subscribe({
      next: (csvData: string) => {
        const parsed: ParseResult<any> = Papa.parse(csvData, { header: true, skipEmptyLines: true });
        const validRows = parsed.data.filter((row: any) =>
          row[layer.latField || 'latitude'] && row[layer.lonField || 'longitude'] &&
          !isNaN(parseFloat(row[layer.latField || 'latitude'])) &&
          !isNaN(parseFloat(row[layer.lonField || 'longitude']))
        );

        const features = validRows.map(row => {
          const lon = parseFloat(row[layer.lonField || 'longitude']);
          const lat = parseFloat(row[layer.latField || 'latitude']);
          return {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [lon, lat] },
            properties: row
          };
        });

        const geojson = { type: 'FeatureCollection', features };

        vector.setSource(
          new VectorSource({ features: new GeoJSON().readFeatures(geojson, { featureProjection: 'EPSG:3857' }) })
        );
        vector.setVisible(layer.visible);

        if (!this.map.getLayers().getArray().includes(vector)) this.map.addLayer(vector);

        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error(`Error loading layer ${layer.name}:`, err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  setPlanet(planet: Planet): void {
    if (planet === this.currentPlanet) return;
    this.currentPlanet = planet;
    this.updateStatsLabels();

    this.baseLayer.setSource(new XYZ({ url: this.BASEMAP_URLS[planet] }));

    Object.values(this.layerMap).forEach(l => this.map.removeLayer(l));
    this.layerMap = {};

    this.layers = this.layersByPlanet[planet].map(layer => ({ ...layer }));
    this.layers.forEach(layer => { if (layer.type === 'vector') this.addLayerToMap(layer); });

    const view = this.map.getView();
    view.setCenter([0, 0]);
    view.setZoom(2);
  }

  toggleLayer(layer: Layer): void {
    layer.visible = !layer.visible;
    if (layer.type === 'basemap') this.baseLayer.setVisible(layer.visible);
    const olLayer = this.layerMap[layer.name];
    if (olLayer) olLayer.setVisible(layer.visible);
    this.layersByPlanet[this.currentPlanet] = [...this.layers];
  }

  reorderMapLayers(): void { }

  onLayerDropped(event: CdkDragDrop<Layer[]>): void {
    moveItemInArray(this.layers, event.previousIndex, event.currentIndex);

    // Update OpenLayers layer z-index according to the new array order
    this.layers.forEach((layer, index) => {
      const olLayer = this.layerMap[layer.name];
      if (olLayer) {
        olLayer.setZIndex(index);
      }
    });
  }


  onAddLayer(): void {
    this.isModalOpen = true;
    this.modalMode = 'manual';
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.newLayer = { name: '', type: 'vector', source: '', visible: true, latField: 'latitude', lonField: 'longitude' };
  }

  createManualLayer(): void {
    if (!this.newLayer.name || !this.newLayer.source) return;
    const layer: Layer = { ...this.newLayer };
    this.layers.push(layer);
    this.layersByPlanet[this.currentPlanet] = [...this.layers];
    this.addLayerToMap(layer);
    this.closeModal();
  }

  handleTerminalCommand(event: Event): void {
    const input = event.target as HTMLInputElement;
    const command = input.value.trim().toLowerCase();
    if (!command) return;

    this.terminalLines.push(`> ${command}`);
    switch (command) {
      case 'help': this.terminalLines.push('Available commands: help, clear, layers'); break;
      case 'clear': this.terminalLines = []; break;
      case 'layers': this.layers.forEach(l => this.terminalLines.push(l.name)); break;
      default: this.terminalLines.push('Unknown command'); break;
    }
    input.value = '';
  }

  formatCoord(value: number, type: 'lon' | 'lat') {
    const dir = type === 'lon' ? (value >= 0 ? 'E' : 'W') : (value >= 0 ? 'N' : 'S');
    return `${Math.abs(value).toFixed(4)}° ${dir}`;
  }

  updateStatsLabels(): void {
    switch (this.currentPlanet) {
      case 'earth': this.currentStats = { gravity: 9.81, lonLabel: 'Longitude', latLabel: 'Latitude' }; break;
      case 'moon': this.currentStats = { gravity: 1.62, lonLabel: 'Selenographic Longitude', latLabel: 'Selenographic Latitude' }; break;
      case 'mars': this.currentStats = { gravity: 3.71, lonLabel: 'Ares Longitude', latLabel: 'Ares Latitude' }; break;
    }
  }

  updateLayerColor(layer: Layer): void {
    const olLayer = this.layerMap[layer.name];
    if (!olLayer) return;

    const features = olLayer.getSource()?.getFeatures() || [];
    const color = layer.color || '#FF0000'; // Use selected color

    features.forEach((feature) => {
      feature.setStyle(new Style({
        image: new CircleStyle({
          radius: 5,
          fill: new Fill({ color }),
          stroke: new Stroke({ color: '#000', width: 1 })
        })
      }));
    });
  }

  updateLayerStyle(layer: Layer): void {
    const olLayer = this.layerMap[layer.name];
    if (!olLayer) return;

    const features = olLayer.getSource()?.getFeatures() || [];
    const color = layer.color || '#FF0000';
    const shape = layer.shape || 'circle';

    features.forEach((feature) => {
      let imageStyle;
      switch (shape) {
        case 'square':
          imageStyle = new RegularShape({
            points: 4,
            radius: 5,
            angle: Math.PI / 4,
            fill: new Fill({ color }),
            stroke: new Stroke({ color: '#000', width: 1 })
          });
          break;
        case 'triangle':
          imageStyle = new RegularShape({
            points: 3,
            radius: 6,
            rotation: 0,
            fill: new Fill({ color }),
            stroke: new Stroke({ color: '#000', width: 1 })
          });
          break;
        default:
          imageStyle = new CircleStyle({
            radius: 5,
            fill: new Fill({ color }),
            stroke: new Stroke({ color: '#000', width: 1 })
          });
      }

      feature.setStyle(new Style({ image: imageStyle }));
    });
  }

  removeLayer(layer: Layer): void {
    const olLayer = this.layerMap[layer.name];
    if (olLayer) this.map.removeLayer(olLayer);
    delete this.layerMap[layer.name];
    this.layers = this.layers.filter(l => l.name !== layer.name);
    this.layersByPlanet[this.currentPlanet] = [...this.layers];
  }

  addFIRMSLayer(): void {
    if (this.layersByPlanet.earth.some(l => l.name === 'Current Fires (FIRMS)')) return;
    const layer: Layer = {
      name: 'Current Fires (FIRMS)',
      type: 'vector',
      source: 'https://gis-webview.onrender.com/firms',
      visible: true,
      latField: 'latitude',
      lonField: 'longitude',
      isCSV: true
    };
    this.layersByPlanet.earth.push(layer);
    this.layers.push({ ...layer });
    this.addLayerToMap(layer);
  }
}
