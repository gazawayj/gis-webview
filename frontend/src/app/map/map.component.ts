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

import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import { toLonLat as olToLonLat } from 'ol/proj';
import { defaults as defaultControls } from 'ol/control';
import { MapBrowserEvent } from 'ol';

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
  imports: [CommonModule, FormsModule, DragDropModule],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})
export class MapComponent implements OnInit {

  @ViewChild('mapContainer', { static: true })
  mapContainer!: ElementRef<HTMLDivElement>;

  map!: Map;

  /**
   * OpenLayers basemap layer
   */
  baseLayer!: TileLayer<XYZ>;

  /**
   * Layer pane model (includes basemap as first entry)
   */
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
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initializeMap();
    this.isLoading = false;
  }

  private initializeMap(): void {
    this.baseLayer = new TileLayer({
      visible: true,
      source: new XYZ({
        url: this.BASEMAP_URLS[this.currentPlanet]
      })
    });

    /**
     * Basemap appears as the FIRST layer in the layer pane
     */
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

        if (this.currentPlanet === 'earth') {
          this.currentStats.lonLabel = 'Longitude';
          this.currentStats.latLabel = 'Latitude';
        } else if (this.currentPlanet === 'moon') {
          this.currentStats.lonLabel = 'Selenographic Longitude';
          this.currentStats.latLabel = 'Selenographic Latitude';
        } else {
          this.currentStats.lonLabel = 'Ares Longitude';
          this.currentStats.latLabel = 'Ares Latitude';
        }

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
      if (evt.coordinate) {
        updateAll(evt.coordinate as [number, number]);
      }
    });
  }

  setPlanet(planet: Planet): void {
    if (planet === this.currentPlanet) return;

    this.currentPlanet = planet;

    if (planet === 'earth') this.currentStats.gravity = 9.81;
    if (planet === 'moon') this.currentStats.gravity = 1.62;
    if (planet === 'mars') this.currentStats.gravity = 3.71;

    const url = this.BASEMAP_URLS[planet];

    this.baseLayer.setSource(new XYZ({ url }));
    this.layers[0].source = url;

    const view = this.map.getView();
    view.setCenter([0, 0]);
    view.setZoom(2);
  }

  toggleLayer(layer: Layer): void {
    layer.visible = !layer.visible;

    if (layer.type === 'basemap') {
      this.baseLayer.setVisible(layer.visible);
    }
  }

  onAddLayer(): void {
    this.isModalOpen = true;
    this.modalMode = 'manual';
  }

  createManualLayer(): void {
    if (this.newLayer.name && this.newLayer.source) {
      this.layers.push({ ...this.newLayer });
      this.newLayer = { name: '', type: 'vector', source: '', visible: true };
      this.closeModal();
    }
  }

  closeModal(): void {
    this.isModalOpen = false;
  }

  handleTerminalCommand(evt: Event): void {
    const keyboardEvent = evt as KeyboardEvent;
    const inputEl = keyboardEvent.target as HTMLInputElement;
    const command = inputEl.value.trim();
    if (!command) return;

    this.terminalLines.push(`> ${command}`);
    inputEl.value = '';
  }

  onLayerDropped(event: any): void {
    const moved = this.layers.splice(event.previousIndex, 1)[0];
    this.layers.splice(event.currentIndex, 0, moved);
  }

  terminalLinesList(): string[] {
    return this.terminalLines;
  }

  formatCoord(value: number, type: 'lon' | 'lat'): string {const abs = Math.abs(value);

  if (type === 'lon') {
    // Negative → W, Positive → E
    const west = value < 0 ? abs : 360 - value;
    const east = value >= 0 ? value : 360 - abs;

    return `${west.toFixed(2)}° W / ${east.toFixed(2)}° E`;
  } else {
    // Latitude: Positive → N, Negative → S
    const dir = value >= 0 ? 'N' : 'S';
    return `${abs.toFixed(2)}° ${dir}`;
  }
}
}
