import {
  Component,
  AfterViewInit,
  ViewChild,
  ElementRef,
  Inject
} from '@angular/core';
import { CommonModule, TitleCasePipe, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PLATFORM_ID } from '@angular/core';

import XYZ from 'ol/source/XYZ';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import TileArcGISRest from 'ol/source/TileArcGISRest';

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

  constructor(@Inject(PLATFORM_ID) private platformId: Object) { }

  /* ------------------------------------------------------------------
   * MAP + LAYERS
   * ------------------------------------------------------------------ */

  private map!: Map;
  private baseLayer!: TileLayer<TileArcGISRest>;
  private overlayLayers: Record<string, TileLayer<TileArcGISRest>> = {};

  currentPlanet: Planet = 'earth';

  /* ------------------------------------------------------------------
   * BASEMAP SOURCES
   * ------------------------------------------------------------------ */

  private getBasemapSource(planet: Planet): TileArcGISRest {
    const urls: Record<Planet, string> = {
      earth:
        'https://services.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer',
      mars:
        'http://s3-eu-west-1.amazonaws.com/whereonmars.cartodb.net/celestia_mars-shaded-16k_global/{z}/{x}/{-y}.png',
      moon:
        'https://s3.amazonaws.com/opmbuilder/301_moon/tiles/w/hillshaded-albedo/%7Bz%7D/%7Bx%7D/%7B-y%7D.png'
    };

    return new TileArcGISRest({
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
   * LAYER DEFINITIONS (UI)
   * ------------------------------------------------------------------ */
  layersByPlanet: Record<Planet, LayerItem[]> = {
    earth: [
      {
        id: 'earth-base',
        name: 'Earth Basemap',
        description: 'Surface reference',
        visible: true,
        type: 'basemap'
      },
      {
        id: 'earth-base',
        name: 'Continent Outline',
        description: 'Boundaries of Earth’s continents',
        visible: false,
        type: 'overlay'
      }
    ],
    mars: [
      {
        id: 'mars-base',
        name: 'Mars Basemap',
        description: 'Global Mars reference imagery',
        visible: true,
        type: 'basemap'
      },
      {
        id: 'lroc',
        name: 'MOLA Elevation',
        description: 'Mars Global Surveyor elevation model',
        visible: false,
        type: 'overlay'
      },
      {
        id: 'mars-base',
        name: 'THEMIS Imagery',
        description: 'High-resolution surface imagery',
        visible: false,
        type: 'overlay'
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

  get layers(): LayerItem[] {
    const currentLayers = this.layersByPlanet[this.currentPlanet] || [];
    // Separate basemap and overlays, then put overlays first so basemap is at the bottom
    const overlays = currentLayers.filter(l => l.type === 'overlay');
    const basemap = currentLayers.filter(l => l.type === 'basemap');

    return [...overlays, ...basemap];
  }

  /* ------------------------------------------------------------------
   * LIFECYCLE
   * ------------------------------------------------------------------ */

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.initMap();
    this.setPlanet(this.currentPlanet);
    setTimeout(() => {
      this.map.updateSize();
    }, 0);
  }

  /* ------------------------------------------------------------------
   * MAP INITIALIZATION
   * ------------------------------------------------------------------ */

  private initMap(): void {
    this.baseLayer = new TileLayer({
      visible: true,
      zIndex: 0
    });

    this.map = new Map({
      target: this.mapContainer.nativeElement,
      layers: [this.baseLayer],
      view: new View({
        projection: 'EPSG:4326',
        center: [0, 0],
        zoom: 0,
        minZoom: 0,
        maxZoom: 12
      })
    });
  }

  /* ------------------------------------------------------------------
   * PLANET SWITCHING
   * ------------------------------------------------------------------ */

  setPlanet(planet: Planet): void {
    this.currentPlanet = planet;

    // Remove overlays
    Object.values(this.overlayLayers).forEach(layer =>
      this.map.removeLayer(layer)
    );
    this.overlayLayers = {};

    // Reset UI state
    this.layersByPlanet[planet].forEach(layer => {
      layer.visible = layer.type === 'basemap';
    });

    // Apply basemap
    this.baseLayer.setSource(this.getBasemapSource(planet));
    this.baseLayer.setVisible(true);

    const view = this.map.getView();

    if (planet === 'earth') {
      view.setCenter([-100, 40]);
      view.setZoom(4);
    } else {
      view.setCenter([0, 0]);
      view.setZoom(0);
    }
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
      const overlay = new TileLayer({
        source: this.getOverlaySource(layer.id),
        visible: layer.visible,
        zIndex: 1
      });

      this.overlayLayers[layer.id] = overlay;
      this.map.addLayer(overlay);
    } else {
      this.overlayLayers[layer.id].setVisible(layer.visible);
    }
  }
}