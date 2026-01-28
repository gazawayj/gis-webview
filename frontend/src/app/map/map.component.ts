import { Component, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { get as getProjection } from 'ol/proj';
import { isPlatformBrowser } from '@angular/common';
import { Inject, PLATFORM_ID } from '@angular/core';

import TileGrid from 'ol/tilegrid/TileGrid';
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

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  //  RESTful API to pull base map sources.
  private getBasemapSource(planet: Planet): TileArcGISRest {
    const urls: Record<Planet, string> = {
      earth: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer',
      mars: 'https://tiles.arcgis.com/tiles/RS8mqPfEEjgYh6uG/arcgis/rest/services/Mars_basemap/MapServer',
      moon: 'https://bm2ms.rsl.wustl.edu/arcgis/rest/services/moon_s/moon_bm_usgs_Unified_Geologic_Map_p2_s/MapServer'
    };
    return new TileArcGISRest({
      url: urls[planet],
      projection: 'EPSG:4326',
      tileGrid: this.planetaryTileGrid,
      crossOrigin: 'anonymous',
      params: {
        'f': 'image',
        'FORMAT': 'PNG32'
      }
    });
  }

  //  Layer URLS to be added onto base maps
  private readonly OVERLAY_URLS: Record<string, string> = {
    'continent': 'https://services.arcgisonline.com',
    'mola': 'https://tiles.arcgis.com',
    'imagery': 'https://tiles.arcgis.com',
    'lroc': 'https://tiles.arcgis.com/tiles/P3ePLMYs2RVChkJx/arcgis/rest/services/Moon_LRO_LROC_WAC_Global_Mosaic_100m/MapServer'
  };

  private map!: Map;
  private baseLayer!: TileLayer<TileArcGISRest>;
  private overlayLayers: Record<string, TileLayer<TileArcGISRest>> = {};

  currentPlanet: Planet = 'earth';

  private planetaryTileGrid = new TileGrid({
    extent: [-180, -90, 180, 90],
    tileSize: 256,
    // Added more levels to support zoom up to 12
    resolutions: [
      0.703125, 0.3515625, 0.17578125, 0.087890625, 0.0439453125,
      0.02197265625, 0.010986328125, 0.0054931640625, 0.00274658203125,
      0.001373291015625, 0.0006866455078125, 0.00034332275390625, 0.000171661376953125
    ]
  });

  // Lifecycle
  ngAfterViewInit(): void {
  if (!isPlatformBrowser(this.platformId)) {
    return;
  }

  this.initMap();
  this.setPlanet(this.currentPlanet);
}

  // Layer definitions per planet (temporary hardcoded)
  layersByPlanet: Record<Planet, LayerItem[]> = {  //Temp until loading from streams
    earth: [
      {
        id: 'earth-base',
        name: 'Earth Basemap',
        description: 'Primary Earth surface reference',
        visible: true,
        type: 'basemap'
      },
      {
        id: 'continent',
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
        id: 'mola',
        name: 'MOLA Elevation',
        description: 'Mars Global Surveyor elevation model',
        visible: false,
        type: 'overlay'
      },
      {
        id: 'imagery',
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

  // Convenience getter for template access
  get layers(): LayerItem[] {
    return this.layersByPlanet[this.currentPlanet];
  }

  // Map setup
  private initMap(): void {
    this.baseLayer = new TileLayer({
      zIndex: 0,
      visible: true
    });
    this.map = new Map({
      target: this.mapContainer.nativeElement,
      layers: [this.baseLayer],
      view: new View({
        projection: 'EPSG:4326',
        center: [0, 0],
        minZoom: 0,
        maxZoom: 12
      })
    });
  }

  // Planet switching
  setPlanet(planet: Planet): void {
    this.currentPlanet = planet;
    // Clear existing overlays
    Object.values(this.overlayLayers).forEach(layer => this.map.removeLayer(layer));
    this.overlayLayers = {};
    // Reset layer visibility states in the model
    this.layersByPlanet[planet].forEach(layer => {
      layer.visible = (layer.type === 'basemap');
    });
    // Apply new basemap source
    this.baseLayer.setSource(this.getBasemapSource(planet));
    this.baseLayer.setVisible(true);
    // Set appropriate center for each planet
    const view = this.map.getView();
    if (planet === 'earth') {
      view.setCenter([-100, 40]);
      view.setZoom(4);  // North America
    } 
    else if (planet === 'moon') {
      view.setCenter([0, -150]);
      view.setZoom(5);
    }
    else {
      view.setCenter([0, 0]); // Global center for Mars/Moon
      view.setZoom(0);
    }
  }

  // Layer toggling
  toggleLayer(layer: LayerItem): void {
    if (layer.type === 'basemap') {
      this.baseLayer.setVisible(layer.visible);
      return;
    }
    if (!this.overlayLayers[layer.id]) {
      const overlay = new TileLayer({
        zIndex: 1,
        source: this.getOverlaySource(layer.id),
        visible: layer.visible
      });

      this.overlayLayers[layer.id] = overlay;
      this.map.addLayer(overlay);
    } else {
      this.overlayLayers[layer.id].setVisible(layer.visible);
    }
  }

  protected getOverlaySource(layerId: string): TileArcGISRest {
    return new TileArcGISRest({
      url: this.OVERLAY_URLS[layerId],
      projection: getProjection('EPSG:4326')!,
      tileGrid: this.planetaryTileGrid,
      crossOrigin: 'anonymous',
      params: { 'TRANSPARENT': true } // Important for overlays
    });
  }
}
