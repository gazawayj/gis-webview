import { Component, AfterViewInit, ViewChild, ElementRef, Inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule, TitleCasePipe, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PLATFORM_ID } from '@angular/core';

import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import TileArcGISRest from 'ol/source/TileArcGISRest';
import ScaleLine from 'ol/control/ScaleLine';
import { fromLonLat, toLonLat } from 'ol/proj';

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
  gravity: string;
  latLabel: string;
  lonLabel: string;
}

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FormsModule, TitleCasePipe],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})
export class MapComponent implements AfterViewInit {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  public map!: Map;
  public zoomDisplay: string = '2.0';
  public currentLon: string = '0.00°';
  public currentLat: string = '0.00°';
  public currentPlanet: Planet = 'earth';
  public layers: LayerItem[] = [];
  public isLoading: boolean = false;

  private baseLayer!: TileLayer<XYZ | TileArcGISRest>;
  private overlayLayers: Record<string, TileLayer<TileArcGISRest>> = {};

  private readonly PLANET_RADII: Record<Planet, number> = {
    earth: 1.0,
    mars: 0.532,
    moon: 0.273
  };

  private planetStates: Record<Planet, PlanetState> = {
    earth: {
      center: fromLonLat([-100, 40]), zoom: 4, gravity: '9.81 m/s²',
      latLabel: 'Latitude', lonLabel: 'Longitude'
    },
    mars: {
      center: [0, 0], zoom: 3, gravity: '3.71 m/s²',
      latLabel: 'Areographic Lat', lonLabel: 'Areographic Lon'
    },
    moon: {
      center: [0, 0], zoom: 3.6, gravity: '1.62 m/s²',
      latLabel: 'Selenographic Lat', lonLabel: 'Selenographic Lon'
    }
  };

  // Note: Updated lroc URL to the full service endpoint to prevent 404s
  private readonly OVERLAY_URLS: Record<string, string> = {
    lroc: 'https://gibs.earthdata.nasa.gov' +
         'LRO_WAC_Mosaic/default/2014-01-01/' +
         'GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg'
  };

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdr: ChangeDetectorRef
  ) { }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.initMap();
    queueMicrotask(() => {
      this.setPlanet('earth');
      this.map.updateSize();
      this.cdr.detectChanges();
    });
  }

  private initMap(): void {
    this.baseLayer = new TileLayer({ zIndex: 0 });

    const scaleLine = new ScaleLine({
      units: 'metric',
      className: 'custom-scale-line'
    });

    this.map = new Map({
      target: this.mapContainer.nativeElement,
      layers: [this.baseLayer],
      controls: [scaleLine],
      view: new View({
        projection: 'EPSG:3857',
        center: [0, 0],
        zoom: 2
      })
    });

    this.map.on('moveend', () => {
      const zoom = this.map.getView().getZoom();
      this.zoomDisplay = zoom ? zoom.toFixed(1) : '2.0';
      this.cdr.detectChanges();
    });

    this.map.on('pointermove', (evt) => {
      if (evt.coordinate) {
        const lonLat = toLonLat(evt.coordinate);
        this.currentLon = `${lonLat[0].toFixed(2)}°`;
        this.currentLat = `${lonLat[1].toFixed(2)}°`;
        this.cdr.detectChanges();
      }
    });

    this.setupLoadingListeners();
    queueMicrotask(() => this.makeScaleDraggable());
  }

  private setupLoadingListeners(): void {
    this.map.on('loadstart', () => { this.isLoading = true; this.cdr.detectChanges(); });
    this.map.on('loadend', () => { this.isLoading = false; this.cdr.detectChanges(); });
  }

  private makeScaleDraggable(): void {
    const scaleEl = document.querySelector('.custom-scale-line') as HTMLElement;
    if (!scaleEl) return;

    let isDragging = false;
    let offset = { x: 0, y: 0 };
    scaleEl.style.cursor = 'move';

    scaleEl.addEventListener('mouseenter', () => {
      this.map.getInteractions().forEach(i => i.setActive(false));
    });

    scaleEl.addEventListener('mouseleave', () => {
      if (!isDragging) {
        this.map.getInteractions().forEach(i => i.setActive(true));
      }
    });

    scaleEl.addEventListener('mousedown', (e: MouseEvent) => {
      isDragging = true;
      const rect = scaleEl.getBoundingClientRect();
      offset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      e.preventDefault();
      e.stopPropagation();
    });

    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (!isDragging) return;
      scaleEl.style.right = 'auto';
      scaleEl.style.bottom = 'auto';
      scaleEl.style.left = `${e.clientX - offset.x}px`;
      scaleEl.style.top = `${e.clientY - offset.y}px`;
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        this.map.getInteractions().forEach(i => i.setActive(true));
      }
    });
  }

  setPlanet(planet: Planet): void {
    const view = this.map.getView();

    if (this.currentPlanet) {
      this.planetStates[this.currentPlanet].center = view.getCenter() || [0, 0];
      this.planetStates[this.currentPlanet].zoom = view.getZoom() || 3;
    }

    this.currentPlanet = planet;

    Object.values(this.overlayLayers).forEach(layer => this.map.removeLayer(layer));
    this.overlayLayers = {};

    const planetLayers = this.layersByPlanet[planet];
    this.layers = planetLayers.map((l, index) => ({
      ...l,
      visible: l.type === 'basemap',
      zIndex: planetLayers.length - 1 - index
    }));

    const baseData = this.layers.find(l => l.type === 'basemap');
    if (baseData) {
      this.baseLayer.setSource(this.getBasemapSource(planet));
      this.baseLayer.setZIndex(baseData.zIndex);
    }

    view.getProjection().setGetPointResolution((res) => res * this.PLANET_RADII[planet]);

    const targetState = this.planetStates[planet];
    const isEarth = planet === 'earth';
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
      earth:
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      mars:
        'https://mars-gis.netlify.app/tiles/{z}/{x}/{y}.png', 
      moon:
        'https://moon-gis.netlify.app/tiles/{z}/{x}/{y}.png'
    };
    return new XYZ({ url: urls[planet], crossOrigin: 'anonymous' });
  }


  toggleLayer(layer: LayerItem): void {
    if (layer.type === 'basemap') {
      this.baseLayer.setVisible(layer.visible);
      return;
    }
    if (!this.overlayLayers[layer.id]) {
      const source = new TileArcGISRest({ url: this.OVERLAY_URLS[layer.id], crossOrigin: 'anonymous' });
      const overlay = new TileLayer({ source, visible: layer.visible, zIndex: layer.zIndex });
      this.overlayLayers[layer.id] = overlay;
      this.map.addLayer(overlay);
    } else {
      this.overlayLayers[layer.id].setVisible(layer.visible);
    }
  }

  get currentStats() { return this.planetStates[this.currentPlanet]; }

  layersByPlanet: Record<Planet, LayerItem[]> = {
    earth: [{ id: 'earth-base', name: 'Earth Basemap', description: 'Global surface imagery', visible: true, type: 'basemap', zIndex: 0 }],
    mars: [{ id: 'mars-base', name: 'Mars Basemap', description: 'Global Mars reference', visible: true, type: 'basemap', zIndex: 0 }],
    moon: [
      { id: 'lroc', name: 'LROC Details', description: 'High-res lunar imagery', visible: false, type: 'overlay', zIndex: 1 },
      { id: 'moon-base', name: 'Moon Basemap', description: 'Global lunar reference', visible: true, type: 'basemap', zIndex: 0 }
    ]
  };
}
