import {
  Component,
  AfterViewInit,
  ViewChild,
  ElementRef,
  Inject,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule, TitleCasePipe, isPlatformBrowser } from '@angular/common';
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
}

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FormsModule, TitleCasePipe],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})
export class MapComponent implements AfterViewInit {
  @ViewChild('mapContainer', { static: true })
  mapContainer!: ElementRef<HTMLDivElement>;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdr: ChangeDetectorRef
  ) { }

  /* ------------------------------------------------------------------
   * MAP + LAYERS
   * ------------------------------------------------------------------ */

  private map!: Map;
  private baseLayer!: TileLayer<XYZ | TileArcGISRest>;
  private overlayLayers: Record<string, TileLayer<TileArcGISRest>> = {};

  currentPlanet: Planet = 'earth';
  layers: LayerItem[] = [];

  /* ------------------------------------------------------------------
   * LIFECYCLE
   * ------------------------------------------------------------------ */

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.initMap();

    // 🔑 Defer planet setup until AFTER Angular stabilizes
    queueMicrotask(() => {
      this.setPlanet('earth');
      this.map.updateSize();

      // 🔑 Tell Angular we're done mutating bound state
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
  }

  /* ------------------------------------------------------------------
   * BASEMAP SOURCES
   * ------------------------------------------------------------------ */

  private getBasemapSource(planet: Planet): XYZ {
    const urls: Record<Planet, string> = {
      earth:
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',

      mars:
        'https://cartocdn-gusc.global.ssl.fastly.net/opmbuilder/api/v1/map/named/opm-mars-basemap-v0-2/all/{z}/{x}/{y}.png',

      moon:
        'https://cartocdn-gusc.global.ssl.fastly.net/opmbuilder/api/v1/map/named/opm-moon-basemap-v0-1/all/{z}/{x}/{y}.png'
    };

    return new XYZ({
      url: urls[planet],
      crossOrigin: 'anonymous'
    });
  }

  /* ------------------------------------------------------------------
   * OVERLAY SOURCES
   * ------------------------------------------------------------------ */

  private readonly OVERLAY_URLS: Record<string, string> = {
    lroc:
      'https://tiles.arcgis.com/tiles/P3ePLMYs2RVChkJx/arcgis/rest/services/Moon_LRO_LROC_WAC_Global_Mosaic_100m/MapServer'
  };

  protected getOverlaySource(layerId: string): TileArcGISRest {
    return new TileArcGISRest({
      url: this.OVERLAY_URLS[layerId],
      crossOrigin: 'anonymous'
    });
  }

  /* ------------------------------------------------------------------
   * PLANET SWITCHING
   * ------------------------------------------------------------------ */

  setPlanet(planet: Planet): void {
    this.currentPlanet = planet;

    Object.values(this.overlayLayers).forEach(layer =>
      this.map.removeLayer(layer)
    );
    this.overlayLayers = {};

    this.layers = this.layersByPlanet[planet].map(l => ({
      ...l,
      visible: l.type === 'basemap'
    }));

    this.baseLayer.setSource(this.getBasemapSource(planet));
    this.baseLayer.setVisible(true);

    const view =
      planet === 'earth'
        ? new View({
          projection: 'EPSG:3857',
          center: fromLonLat([-100, 40]),
          zoom: 4,
          minZoom: 2,
          maxZoom: 18
        })
        : new View({
          projection: 'EPSG:4326',
          center: [0, 0],
          zoom: 0,
          minZoom: 0,
          maxZoom: 8
        });

    this.map.setView(view);
  }

  /* ------------------------------------------------------------------
   * LAYER DEFINITIONS
   * ------------------------------------------------------------------ */

  layersByPlanet: Record<Planet, LayerItem[]> = {
    earth: [
      {
        id: 'earth-base',
        name: 'Earth Basemap',
        description: 'Global surface reference',
        visible: true,
        type: 'basemap'
      }
    ],
    mars: [
      {
        id: 'mars-base',
        name: 'Mars Basemap',
        description: 'Global Mars reference imagery',
        visible: true,
        type: 'basemap'
      }
    ],
    moon: [
      {
        id: 'moon-base',
        name: 'Moon Basemap',
        description: 'Global lunar reference',
        visible: true,
        type: 'basemap'
      },
      {
        id: 'lroc',
        name: 'LROC Details',
        description: 'High-resolution lunar imagery',
        visible: false,
        type: 'overlay'
      }
    ]
  };

  /* ------------------------------------------------------------------
   * OVERLAY TOGGLING
   * ------------------------------------------------------------------ */

  toggleLayer(layer: LayerItem): void {
    if (layer.type === 'basemap') {
      this.baseLayer.setVisible(layer.visible);
      return;
    }

    if (!this.overlayLayers[layer.id]) {
      const overlay = new TileLayer({
        source: this.getOverlaySource(layer.id),
        visible: layer.visible,
        zIndex: 10
      });

      this.overlayLayers[layer.id] = overlay;
      this.map.addLayer(overlay);
    } else {
      this.overlayLayers[layer.id].setVisible(layer.visible);
    }
  }
}