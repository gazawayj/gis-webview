import {
  Component,
  AfterViewInit,
  ViewChild,
  ElementRef,
  Inject,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PLATFORM_ID } from '@angular/core';

import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import TileArcGISRest from 'ol/source/TileArcGISRest';
import { fromLonLat } from 'ol/proj';

type Planet = 'earth' | 'mars' | 'moon';

interface LayerItem {
  id: string;
  name: string;
  description: string;
  visible: boolean;
  type: 'basemap' | 'overlay';
  zIndex: number;
}

interface PlanetState {
  center: number[];
  zoom: number;
}

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})
export class MapComponent implements AfterViewInit {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  // --- Public Template Variables ---
  public map!: Map;
  public zoomDisplay: string = '2.0';
  public currentPlanet: Planet = 'earth';
  public layers: LayerItem[] = [];
  public isLoading: boolean = false;

  // --- Private Map Properties ---
  private baseLayer!: TileLayer<XYZ | TileArcGISRest>;
  private overlayLayers: Record<string, TileLayer<TileArcGISRest>> = {};

  // Memory to hold independent zoom/center per planet
  private planetStates: Record<Planet, PlanetState> = {
    earth: { center: fromLonLat([-100, 40]), zoom: 4 },
    mars: { center: [0, 0], zoom: 3 },
    moon: { center: [0, 0], zoom: 3 }
  };

  private readonly OVERLAY_URLS: Record<string, string> = {
    lroc: 'https://tiles.arcgis.com'
  };

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdr: ChangeDetectorRef
  ) { }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.initMap();
    
    queueMicrotask(() => {
      this.setPlanet('earth'); // Load Earth as default
      this.map.updateSize();
      this.cdr.detectChanges();
    });
  }

  /* ------------------------------------------------------------------
   * MAP INITIALIZATION
   * ------------------------------------------------------------------ */

  private initMap(): void {
    this.baseLayer = new TileLayer({ zIndex: 0 });

    this.map = new Map({
      target: this.mapContainer.nativeElement,
      layers: [this.baseLayer],
      view: new View({
        projection: 'EPSG:3857',
        center: [0, 0],
        zoom: 2
      })
    });

    // Update the Zoom Display variable whenever the map moves
    this.map.on('moveend', () => {
      const zoom = this.map.getView().getZoom();
      this.zoomDisplay = zoom ? zoom.toFixed(1) : '2.0';
      this.cdr.detectChanges();
    });

    this.setupLoadingListeners();
  }

  private setupLoadingListeners(): void {
    this.map.on('loadstart', () => {
      this.isLoading = true;
      this.cdr.detectChanges();
    });
    this.map.on('loadend', () => {
      this.isLoading = false;
      this.cdr.detectChanges();
    });
  }

  /* ------------------------------------------------------------------
   * PLANET SWITCHING & STATE MANAGEMENT
   * ------------------------------------------------------------------ */

  setPlanet(planet: Planet): void {
    const view = this.map.getView();

    // 1. SAVE the state of the current planet before switching
    if (this.currentPlanet) {
      this.planetStates[this.currentPlanet] = {
        center: view.getCenter() || [0, 0],
        zoom: view.getZoom() || 3
      };
    }

    // 2. Set the new planet
    this.currentPlanet = planet;

    // 3. Clear existing overlays
    Object.values(this.overlayLayers).forEach(layer => this.map.removeLayer(layer));
    this.overlayLayers = {};

    // 4. Setup layers and zIndex (Bottom item in list = zIndex 0)
    const planetLayers = this.layersByPlanet[planet];
    this.layers = planetLayers.map((l, index) => ({
      ...l,
      visible: l.type === 'basemap',
      zIndex: planetLayers.length - 1 - index 
    }));

    // 5. Update Basemap Source and Z-Index
    const baseData = this.layers.find(l => l.type === 'basemap');
    if (baseData) {
      this.baseLayer.setSource(this.getBasemapSource(planet));
      this.baseLayer.setZIndex(baseData.zIndex);
    }

    // 6. RESTORE the saved state for the new planet
    const targetState = this.planetStates[planet];
    const isEarth = planet === 'earth';

    // Set constraints based on target planet before animating
    view.setMinZoom(isEarth ? 2 : 1);
    view.setMaxZoom(isEarth ? 18 : 8);

    view.animate({
      center: targetState.center,
      zoom: targetState.zoom,
      duration: 1000
    });
  }

  private getBasemapSource(planet: Planet): XYZ {
    const urls: Record<Planet, string> = {
      earth: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      mars: 'https://cartocdn-gusc.global.ssl.fastly.net/opmbuilder/api/v1/map/named/opm-mars-basemap-v0-2/all/{z}/{x}/{y}.png',
      moon: 'https://cartocdn-gusc.global.ssl.fastly.net/opmbuilder/api/v1/map/named/opm-moon-basemap-v0-1/all/{z}/{x}/{y}.png'
    };

    return new XYZ({
      url: urls[planet],
      crossOrigin: 'anonymous'
    });
  }

  /* ------------------------------------------------------------------
   * OVERLAY TOGGLING
   * ------------------------------------------------------------------ */

  toggleLayer(layer: LayerItem): void {
    if (layer.type === 'basemap') {
      this.baseLayer.setVisible(layer.visible);
      return;
    }

    if (!this.overlayLayers[layer.id]) {
      const source = new TileArcGISRest({
        url: this.OVERLAY_URLS[layer.id],
        crossOrigin: 'anonymous'
      });
      const overlay = new TileLayer({
        source,
        visible: layer.visible,
        zIndex: layer.zIndex
      });
      this.overlayLayers[layer.id] = overlay;
      this.map.addLayer(overlay);
    } else {
      this.overlayLayers[layer.id].setVisible(layer.visible);
    }
  }

  /* ------------------------------------------------------------------
   * DATA DEFINITIONS
   * ------------------------------------------------------------------ */

  layersByPlanet: Record<Planet, LayerItem[]> = {
    earth: [
      { id: 'earth-base', name: 'Earth Basemap', description: 'Global surface imagery', visible: true, type: 'basemap', zIndex: 0 }
    ],
    mars: [
      { id: 'mars-base', name: 'Mars Basemap', description: 'Global Mars reference', visible: true, type: 'basemap', zIndex: 0 }
    ],
    moon: [
      { id: 'lroc', name: 'LROC Details', description: 'High-res lunar imagery', visible: false, type: 'overlay', zIndex: 1 },
      { id: 'moon-base', name: 'Moon Basemap', description: 'Global lunar reference', visible: true, type: 'basemap', zIndex: 0 }
    ]
  };
}
