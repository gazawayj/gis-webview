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
import { DragDropModule } from '@angular/cdk/drag-drop';
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
import VectorSource from 'ol/source/Vector.js';
import GeoJSON from 'ol/format/GeoJSON';
import Style from 'ol/style/Style';
import CircleStyle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import Papa from 'papaparse';

type Planet = 'earth' | 'moon' | 'mars';

interface Layer {
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
  firmsLayer!: VectorLayer<VectorSource>;

  // track OL layers for FIRMS and manual layers
  layerMap: Record<string, VectorLayer<VectorSource>> = {};

  layers: Layer[] = [];

  isLoading = true;

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

  private readonly BASEMAP_URLS: Record<Planet, string> = {
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
    this.initializeMap();
    this.isLoading = false;

    // Add FIRMS fires layer to Earth by default
    if (this.currentPlanet === 'earth') {
      this.addFIRMSLayer();
    }
  }

  private initializeMap(): void {
    this.baseLayer = new TileLayer({
      visible: true,
      source: new XYZ({ url: this.BASEMAP_URLS[this.currentPlanet] })
    });

    this.layers = [
      {
        name: 'Basemap',
        type: 'basemap',
        source: this.BASEMAP_URLS[this.currentPlanet],
        visible: true,
        description: 'Planet surface imagery'
      }
    ];

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

    // Update coordinates panel
    let lastUpdate = 0;
    const throttleMs = 50;
    const updateAll = (coord?: [number, number]) => {
      const now = performance.now();
      if (now - lastUpdate < throttleMs) return;
      lastUpdate = now;

      this.ngZone.run(() => {
        const center = coord ?? view.getCenter();
        if (!center) return;

        const zoom = view.getZoom() ?? 2;
        let lonLat: [number, number];

        if (this.currentPlanet === 'earth') {
          lonLat = olToLonLat(center) as [number, number];
        } else {
          const OL_WORLD_HALF = 20037508.342789244;
          lonLat = [
            (center[0] / OL_WORLD_HALF) * 180,
            (center[1] / OL_WORLD_HALF) * 180
          ];
        }

        this.updateStatsLabels();

        this.currentLon = parseFloat(lonLat[0].toFixed(6));
        this.currentLat = parseFloat(lonLat[1].toFixed(6));
        this.zoomDisplay = parseFloat(zoom.toFixed(2));

        this.cdr.detectChanges();
      });
    };

    this.map.on('moveend', () => updateAll());
    view.on('change:center', () => updateAll());
    view.on('change:resolution', () => updateAll());
    this.map.on('pointermove', (evt: MapBrowserEvent<any>) => {
      if (evt.coordinate) updateAll(evt.coordinate as [number, number]);
    });
  }

  private updateStatsLabels(): void {
    switch (this.currentPlanet) {
      case 'earth':
        this.currentStats.lonLabel = 'Longitude';
        this.currentStats.latLabel = 'Latitude';
        this.currentStats.gravity = 9.81;
        break;
      case 'moon':
        this.currentStats.lonLabel = 'Selenographic Longitude';
        this.currentStats.latLabel = 'Selenographic Latitude';
        this.currentStats.gravity = 1.62;
        break;
      case 'mars':
        this.currentStats.lonLabel = 'Ares Longitude';
        this.currentStats.latLabel = 'Ares Latitude';
        this.currentStats.gravity = 3.71;
        break;
    }
  }

  private normalizeLon(value: number): { west: number; east: number } {
    const abs = Math.abs(value);
    return {
      west: value < 0 ? abs : 360 - value,
      east: value >= 0 ? value : 360 - abs
    };
  }

  setPlanet(planet: Planet): void {
    if (planet === this.currentPlanet) return;

    this.currentPlanet = planet;
    this.updateStatsLabels();

    const url = this.BASEMAP_URLS[planet];
    this.baseLayer.setSource(new XYZ({ url }));
    this.layers[0].source = url;

    const view = this.map.getView();
    view.setCenter([0, 0]);
    view.setZoom(2);

    // Add FIRMS if switching back to Earth
    if (planet === 'earth' && !this.firmsLayer) {
      this.addFIRMSLayer();
    }
  }

  toggleLayer(layer: Layer): void {
    layer.visible = !layer.visible;

    const olLayer = this.layerMap[layer.name];
    if (olLayer) olLayer.setVisible(layer.visible);

    this.reorderMapLayers();
  }

  onAddLayer(): void {
    this.isModalOpen = true;
    this.modalMode = 'manual';
  }

  createManualLayer(): void {
    if (this.newLayer.name && this.newLayer.source) {
      // Create dummy OL vector layer
      const olLayer = new VectorLayer({
        source: new VectorSource(),
        visible: this.newLayer.visible,
        style: new Style({
          image: new CircleStyle({
            radius: 6,
            fill: new Fill({ color: this.newLayer.color ?? 'blue' }),
            stroke: new Stroke({ color: '#fff', width: 1 })
          })
        })
      });

      this.layerMap[this.newLayer.name] = olLayer;
      this.map.addLayer(olLayer);

      this.layers.push({ ...this.newLayer });
      this.newLayer = { name: '', type: 'vector', source: '', visible: true };
      this.closeModal();

      this.reorderMapLayers();
    }
  }

  closeModal(): void {
    this.isModalOpen = false;
  }

  handleTerminalCommand(evt: Event): void {
    const inputEl = evt.target as HTMLInputElement;
    const command = inputEl.value.trim();
    if (!command) return;

    this.terminalLines.push(`> ${command}`);
    inputEl.value = '';
  }

  onLayerDropped(event: any): void {
    const moved = this.layers.splice(event.previousIndex, 1)[0];
    this.layers.splice(event.currentIndex, 0, moved);

    this.reorderMapLayers();
  }

  private reorderMapLayers(): void {
    if (!this.map) return;

    // Iterate through layers array in panel order (top = last, bottom = first)
    this.layers.forEach((layer, index) => {
      let olLayer: TileLayer<XYZ> | VectorLayer<VectorSource> | undefined;

      if (layer.type === 'basemap') {
        olLayer = this.baseLayer;
      } else if (layer.name === 'Current Fires (FIRMS)') {
        olLayer = this.firmsLayer;
      }
      // TODO: add other manual vector layers here if implemented

      if (olLayer) {
        // Apply visibility
        olLayer.setVisible(layer.visible);

        // Assign zIndex = index in layers array
        // Lower index → lower zIndex → rendered below higher ones
        olLayer.setZIndex(index);
      }
    });
  }

  terminalLinesList(): string[] {
    return this.terminalLines;
  }

  formatCoord(value: number, type: 'lon' | 'lat'): string {
    if (type === 'lon') {
      const { west, east } = this.normalizeLon(value);
      return `${west.toFixed(2)}° W / ${east.toFixed(2)}° E`;
    } else {
      const abs = Math.abs(value);
      const dir = value >= 0 ? 'N' : 'S';
      return `${abs.toFixed(2)}° ${dir}`;
    }
  }

  // ========================= FIRMS LAYER =========================
  addFIRMSLayer() {
    this.http.get('https://gis-webview.onrender.com/firms', { responseType: 'text' })
      .pipe(take(1))
      .subscribe({
        next: (csvData: string) => {
          const parsed = Papa.parse(csvData, { header: true });

          const validRows = (parsed.data as any[])
            .filter(row => !isNaN(parseFloat(row.latitude)) && !isNaN(parseFloat(row.longitude)));

          console.log(`FIRMS: Loaded ${validRows.length} valid fire points.`);

          const features = validRows.map(row => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [parseFloat(row.longitude), parseFloat(row.latitude)]
            },
            properties: {
              brightness: row.brightness,
              date: row.acq_date,
              time: row.acq_time,
              confidence: row.confidence,
              satellite: row.satellite
            }
          }));

          const geojson = {
            type: 'FeatureCollection',
            features
          };

          this.firmsLayer = new VectorLayer({
            source: new VectorSource({
              features: new GeoJSON().readFeatures(geojson, { featureProjection: 'EPSG:3857' })
            }),
            style: new Style({
              image: new CircleStyle({
                radius: 8,
                fill: new Fill({ color: 'red' }),
                stroke: new Stroke({ color: '#fff', width: 1 })
              })
            }),
            visible: false // start hidden
          });

          // Add FIRMS to the map
          this.map.addLayer(this.firmsLayer);

          // Add FIRMS to layers panel for toggle + reordering
          this.layers.push({
            name: 'Current Fires (FIRMS)',
            type: 'vector',
            source: 'https://gis-webview.onrender.com/firms',
            visible: false, // match layer visibility
            description: 'Active fires from FIRMS'
          });

          // Sync zIndex and visibility according to current panel order
          this.reorderMapLayers();
        },
        error: (err) => {
          console.error('Error loading FIRMS CSV:', err);
        }
      });
  }
}
