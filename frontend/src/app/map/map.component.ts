// map.component.ts
import {
  Component,
  ElementRef,
  NgZone,
  OnInit,
  ViewChild,
  ChangeDetectorRef
} from '@angular/core';

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
import { MapBrowserEvent } from 'ol';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import Style from 'ol/style/Style';
import CircleStyle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import Papa, { ParseResult } from 'papaparse';

export type Planet = 'earth' | 'moon' | 'mars';

export interface Layer {
  name: string;
  type: 'vector' | 'raster' | 'basemap';
  source: string;
  visible: boolean;
  color?: string;
  description?: string;
}

interface PlanetStats {
  gravity: number;
  lonLabel: string;
  latLabel: string;
}

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, HttpClientModule],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})
export class MapComponent implements OnInit {

  @ViewChild('mapContainer', { static: true })
  mapContainer!: ElementRef<HTMLDivElement>;

  map!: Map;
  baseLayer!: TileLayer<XYZ>;

  // OL layer instances for all vector layers
  layerMap: Record<string, VectorLayer<VectorSource>> = {};

  // Current planet's layer list for UI
  layers: Layer[] = [];

  // Layers per planet
  layersByPlanet: Record<Planet, Layer[]> = {
    earth: [],
    moon: [],
    mars: []
  };

  isLoading = false;
  loadingMessage = '';

  currentPlanet: Planet = 'earth';
  currentLon = 0;
  currentLat = 0;
  zoomDisplay = 2;

  currentStats: PlanetStats = {
    gravity: 9.81,
    lonLabel: 'Longitude',
    latLabel: 'Latitude'
  };

  isModalOpen = false;
  modalMode: 'manual' | 'console' = 'manual';

  newLayer: Layer = {
    name: '',
    type: 'vector',
    source: '',
    visible: true
  };

  terminalLines: string[] = [];

  readonly BASEMAP_URLS: Record<Planet, string> = {
    earth: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    moon: 'https://moon-gis.netlify.app/tiles/{z}/{x}/{y}.png',
    mars: 'https://mars-gis.netlify.app/tiles/{z}/{x}/{y}.png'
  };

  constructor(
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
    private http: HttpClient
  ) { }

  ngOnInit(): void {
    this.initializePlanetLayers();
    this.initializeMap();
    this.ensureFIRMSLayer();
  }

  initializePlanetLayers(): void {
    const basemapEarth: Layer = {
      name: 'Basemap',
      type: 'basemap',
      source: this.BASEMAP_URLS.earth,
      visible: true,
      description: 'Planet surface imagery'
    };
    const basemapMoon: Layer = { ...basemapEarth, source: this.BASEMAP_URLS.moon };
    const basemapMars: Layer = { ...basemapEarth, source: this.BASEMAP_URLS.mars };

    this.layersByPlanet.earth = [basemapEarth];
    this.layersByPlanet.moon = [basemapMoon];
    this.layersByPlanet.mars = [basemapMars];

    this.layers = [...this.layersByPlanet[this.currentPlanet]];
  }

  initializeMap(): void {
    this.baseLayer = new TileLayer({
      visible: true,
      source: new XYZ({ url: this.BASEMAP_URLS[this.currentPlanet] })
    });

    const view = new View({
      center: [0, 0],
      zoom: 2,
      projection: 'EPSG:3857'
    });

    this.map = new Map({
      target: this.mapContainer.nativeElement,
      layers: [this.baseLayer],
      view,
      controls: defaultControls()
    });

    this.map.on('pointermove', (evt: MapBrowserEvent<any>) => {
      const coord = evt.coordinate;
      if (!coord) return;

      this.ngZone.run(() => {
        const lonLat = olToLonLat(coord) as [number, number];
        this.currentLon = parseFloat(lonLat[0].toFixed(6));
        this.currentLat = parseFloat(lonLat[1].toFixed(6));
        this.zoomDisplay = parseFloat((view.getZoom() ?? 2).toFixed(2));
        this.cdr.detectChanges();
      });
    });

    // Add all current planet layers to map
    this.layers.forEach(layer => this.addLayerToMap(layer));
  }

  createVectorLayer(layer: Layer): VectorLayer<VectorSource> {
    return new VectorLayer({
      source: new VectorSource({
        url: layer.source,
        format: new GeoJSON()
      }),
      visible: layer.visible,
      style: new Style({
        image: new CircleStyle({
          radius: 6,
          fill: new Fill({ color: layer.color || 'red' }),
          stroke: new Stroke({ color: '#fff', width: 1 })
        })
      })
    });
  }

  addLayerToMap(layer: Layer): void {
    if (layer.type === 'vector') {
      // Reuse existing OL layer if it exists
      let olLayer = this.layerMap[layer.name];
      if (!olLayer) {
        olLayer = this.createVectorLayer(layer);
        this.layerMap[layer.name] = olLayer;
      }
      // Add to map if not already added
      if (!this.map.getLayers().getArray().includes(olLayer)) {
        this.map.addLayer(olLayer);
      }
      olLayer.setVisible(layer.visible);
    } else if (layer.type === 'basemap') {
      this.baseLayer.setVisible(layer.visible);
    }
  }

  setPlanet(planet: Planet): void {
    if (planet === this.currentPlanet) return;

    this.currentPlanet = planet;
    this.updateStatsLabels();

    // Update basemap
    this.baseLayer.setSource(new XYZ({ url: this.BASEMAP_URLS[planet] }));

    // Remove all vector layers from map
    Object.values(this.layerMap).forEach(l => this.map.removeLayer(l));

    // Load layers for new planet
    this.layers = this.layersByPlanet[planet].map(layer => ({ ...layer }));
    this.layers.forEach(layer => this.addLayerToMap(layer));

    this.reorderMapLayers();

    // Reset view
    const view = this.map.getView();
    view.setCenter([0, 0]);
    view.setZoom(2);

    // Ensure FIRMS is available for Earth
    if (planet === 'earth') this.ensureFIRMSLayer();
  }

  toggleLayer(layer: Layer): void {
    layer.visible = !layer.visible;

    if (layer.type === 'basemap') this.baseLayer.setVisible(layer.visible);

    const olLayer = this.layerMap[layer.name];
    if (olLayer) olLayer.setVisible(layer.visible);

    this.reorderMapLayers();
    this.layersByPlanet[this.currentPlanet] = [...this.layers];
  }

  reorderMapLayers(): void {
    this.layers.forEach((layer, index) => {
      const olLayer = layer.type === 'basemap' ? this.baseLayer : this.layerMap[layer.name];
      if (olLayer) {
        olLayer.setZIndex(index);
        olLayer.setVisible(layer.visible);
      }
    });
  }

  onLayerDropped(event: CdkDragDrop<Layer[]>): void {
    moveItemInArray(this.layers, event.previousIndex, event.currentIndex);
    this.reorderMapLayers();
  }

  onAddLayer(): void {
    this.modalMode = 'manual';
    this.isModalOpen = true;
    this.layersByPlanet[this.currentPlanet] = [...this.layers];
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.newLayer = { name: '', type: 'vector', source: '', visible: true };
  }

  createManualLayer(): void {
    if (!this.newLayer.name || !this.newLayer.source) return;

    this.layersByPlanet[this.currentPlanet].push({ ...this.newLayer });
    this.layers.push({ ...this.newLayer });
    this.addLayerToMap(this.newLayer);

    this.reorderMapLayers();
    this.closeModal();
  }

  handleTerminalCommand(event: Event): void {
    const input = event.target as HTMLInputElement;
    const command = input.value.trim().toLowerCase();
    if (!command) return;

    this.terminalLines.push(`> ${command}`);

    switch (command) {
      case 'help':
        this.terminalLines.push('Available commands: help, clear, layers');
        break;
      case 'clear':
        this.terminalLines = [];
        break;
      case 'layers':
        this.layers.forEach(l => this.terminalLines.push(l.name));
        break;
      default:
        this.terminalLines.push('Unknown command');
    }

    input.value = '';
  }

  formatCoord(value: number, type: 'lon' | 'lat'): string {
    const dir = type === 'lon' ? (value >= 0 ? 'E' : 'W') : (value >= 0 ? 'N' : 'S');
    return `${Math.abs(value).toFixed(4)}° ${dir}`;
  }

  updateStatsLabels(): void {
    switch (this.currentPlanet) {
      case 'earth':
        this.currentStats = { gravity: 9.81, lonLabel: 'Longitude', latLabel: 'Latitude' };
        break;
      case 'moon':
        this.currentStats = { gravity: 1.62, lonLabel: 'Selenographic Longitude', latLabel: 'Selenographic Latitude' };
        break;
      case 'mars':
        this.currentStats = { gravity: 3.71, lonLabel: 'Ares Longitude', latLabel: 'Ares Latitude' };
        break;
    }
  }

  ensureFIRMSLayer(): void {
    if (!this.layersByPlanet.earth.some(l => l.name === 'Current Fires (FIRMS)')) {
      const firmsLayer: Layer = {
        name: 'Current Fires (FIRMS)',
        type: 'vector',
        source: 'https://gis-webview.onrender.com/firms',
        visible: false,
        description: 'Active fires from FIRMS'
      };
      this.layersByPlanet.earth.push(firmsLayer);
      if (this.currentPlanet === 'earth') this.layers.push({ ...firmsLayer });

      this.isLoading = true;
      this.loadingMessage = 'Loading FIRMS layer...';

      this.http.get(firmsLayer.source, { responseType: 'text' }).pipe(take(1)).subscribe({
        next: (csvData: string) => {
          const parsed: ParseResult<any> = Papa.parse(csvData, { header: true, skipEmptyLines: true });
          const validRows = parsed.data.filter((row: any) =>
            row.latitude && row.longitude &&
            !isNaN(parseFloat(row.latitude)) &&
            !isNaN(parseFloat(row.longitude))
          );

          const features = validRows.map(row => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [parseFloat(row.longitude), parseFloat(row.latitude)] },
            properties: row
          }));

          const geojson = { type: 'FeatureCollection', features };
          const olLayer = new VectorLayer({
            source: new VectorSource({ features: new GeoJSON().readFeatures(geojson, { featureProjection: 'EPSG:3857' }) }),
            style: new Style({
              image: new CircleStyle({ radius: 6, fill: new Fill({ color: 'red' }), stroke: new Stroke({ color: '#fff', width: 1 }) })
            }),
            visible: false
          });

          this.layerMap[firmsLayer.name] = olLayer;
          if (!this.map.getLayers().getArray().includes(olLayer)) {
            this.map.addLayer(olLayer);
          }

          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: () => { this.isLoading = false; }
      });
    }
  }
}
