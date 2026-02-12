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
import Papa from 'papaparse';

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
  firmsLayer?: VectorLayer<VectorSource>;

  layerMap: Record<string, VectorLayer<VectorSource>> = {};
  layers: Layer[] = [];
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

    // Only add FIRMS layer to Earth
    if (this.currentPlanet === 'earth') {
      this.addFIRMSLayer();
    }
  }

  initializePlanetLayers(): void {
    // Basemap layer for current planet (clone for other planets)
    const basemapLayer: Layer = {
      name: 'Basemap',
      type: 'basemap',
      source: this.BASEMAP_URLS[this.currentPlanet],
      visible: true,
      description: 'Planet surface imagery'
    };

    this.layersByPlanet.earth = [{ ...basemapLayer, source: this.BASEMAP_URLS.earth }];
    this.layersByPlanet.moon = [{ ...basemapLayer, source: this.BASEMAP_URLS.moon }];
    this.layersByPlanet.mars = [{ ...basemapLayer, source: this.BASEMAP_URLS.mars }];

    // Initialize current planet's layers array
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

  setPlanet(planet: Planet): void {
    if (planet === this.currentPlanet) return;

    this.currentPlanet = planet;
    this.updateStatsLabels();

    // Update basemap source
    const url = this.BASEMAP_URLS[planet];
    this.baseLayer.setSource(new XYZ({ url }));

    // Remove all vector layers
    Object.values(this.layerMap).forEach(l => this.map.removeLayer(l));
    this.layerMap = {};

    // Load planet-specific layers
    this.layers = this.layersByPlanet[planet].map(layer => ({ ...layer }));
    this.layers.forEach(layer => {
      if (layer.type === 'vector') {
        const vector = new VectorLayer({
          source: new VectorSource({ url: layer.source, format: new GeoJSON() }),
          visible: layer.visible
        });
        this.map.addLayer(vector);
        this.layerMap[layer.name] = vector;
      } else if (layer.type === 'basemap') {
        this.baseLayer.setVisible(layer.visible);
      }
    });

    this.reorderMapLayers();

    // Reset view
    const view = this.map.getView();
    view.setCenter([0, 0]);
    view.setZoom(2);
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
      const olLayer = layer.type === 'basemap'
        ? this.baseLayer
        : this.layerMap[layer.name];

      if (olLayer) {
        olLayer.setZIndex(index);
        olLayer.setVisible(layer.visible);
      }
    });
  }

  onLayerDropped(event: CdkDragDrop<Layer[]>): void {
    moveItemInArray(this.layers, event.previousIndex, event.currentIndex);
    this.reorderMapLayers();
    this.layersByPlanet[this.currentPlanet] = [...this.layers];
  }

  onAddLayer(): void {
    this.modalMode = 'manual';
    this.isModalOpen = true;
    this.layersByPlanet[this.currentPlanet] = [...this.layers];
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.newLayer = {
      name: '',
      type: 'vector',
      source: '',
      visible: true
    };
  }

  createManualLayer(): void {
    if (!this.newLayer.name || !this.newLayer.source) return;

    const vector = new VectorLayer({
      source: new VectorSource({ url: this.newLayer.source, format: new GeoJSON() }),
      visible: this.newLayer.visible
    });

    this.map.addLayer(vector);
    this.layerMap[this.newLayer.name] = vector;

    this.layers.push({ ...this.newLayer });
    this.layersByPlanet[this.currentPlanet] = [...this.layers];

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
    const dir = type === 'lon'
      ? (value >= 0 ? 'E' : 'W')
      : (value >= 0 ? 'N' : 'S');

    return `${Math.abs(value).toFixed(4)}° ${dir}`;
  }

  addFIRMSLayer(): void {
    this.isLoading = true;
    this.loadingMessage = 'Loading FIRMS layer...';

    // Add FIRMS layer only to Earth
    const firLayer: Layer = {
      name: 'Current Fires (FIRMS)',
      type: 'vector',
      source: 'https://gis-webview.onrender.com/firms',
      visible: false,
      description: 'Active fires from FIRMS'
    };

    this.layersByPlanet.earth.push(firLayer);

    this.http.get(firLayer.source, { responseType: 'text' })
      .pipe(take(1))
      .subscribe({
        next: (csvData: string) => {
          const parsed = Papa.parse(csvData, { header: true });
          const validRows = (parsed.data as any[])
            .filter(row => !isNaN(parseFloat(row.latitude)) && !isNaN(parseFloat(row.longitude)));

          const features = validRows.map(row => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [parseFloat(row.longitude), parseFloat(row.latitude)]
            },
            properties: row
          }));

          const geojson = { type: 'FeatureCollection', features };

          this.firmsLayer = new VectorLayer({
            source: new VectorSource({
              features: new GeoJSON().readFeatures(geojson, { featureProjection: 'EPSG:3857' })
            }),
            style: new Style({
              image: new CircleStyle({
                radius: 6,
                fill: new Fill({ color: 'red' }),
                stroke: new Stroke({ color: '#fff', width: 1 })
              })
            }),
            visible: false
          });

          this.map.addLayer(this.firmsLayer);
          this.layerMap[firLayer.name] = this.firmsLayer;

          this.layers.push(firLayer);

          this.reorderMapLayers();
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.isLoading = false;
        }
      });
  }
}
