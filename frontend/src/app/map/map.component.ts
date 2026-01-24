import { Component, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Map from 'ol/Map';
import View from 'ol/View';
import ImageLayer from 'ol/layer/Image';
import ImageStatic from 'ol/source/ImageStatic';
import proj4 from 'proj4';
import { register } from 'ol/proj/proj4.js';
import { get as getProjection } from 'ol/proj.js';

interface LayerItem {
  id: string;
  name: string;
  description: string;
  visible: boolean;
  type: 'basemap' | 'overlay';
}

type Planet = 'earth' | 'mars' | 'moon';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FormsModule, TitleCasePipe],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})
export class MapComponent implements AfterViewInit {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  private map!: Map;
  private baseLayer!: ImageLayer<ImageStatic>;
  private olOverlays: { [key: string]: ImageLayer<ImageStatic> } = {};

  currentPlanet: Planet = 'mars';
  private readonly globalExtent: [number, number, number, number] = [-180, -90, 180, 90];

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

  ngAfterViewInit(): void {
    this.initProjections();
    this.initMap();
    this.setPlanet(this.currentPlanet);
  }

  // --- 1. PROJECTION LOGIC ---
  private initProjections() {
    proj4.defs("IAU2000:49900", "+proj=longlat +a=3396190 +b=3376200 +no_defs");
    register(proj4);
    const proj = getProjection('IAU2000:49900');
    if (proj) proj.setExtent(this.globalExtent);
  }

  // --- 2. MAP INITIALIZATION ---
  private initMap() {
    this.baseLayer = new ImageLayer({ zIndex: 0 });
    this.map = new Map({
      target: this.mapContainer.nativeElement,
      layers: [this.baseLayer],
      view: new View({
        projection: 'IAU2000:49900',
        center: [0, 0],
        zoom: 2,
        extent: this.globalExtent
      })
    });
  }

  // --- 3. PLANET SELECTION ---
  setPlanet(planet: Planet) {
    this.currentPlanet = planet;
    // Remove all existing overlay layers from the map ---
    Object.values(this.olOverlays).forEach(layer => {
      this.map.removeLayer(layer);
    });
    this.olOverlays = {};
    // Reset all layer visibility flags ---
    this.layersByPlanet[planet].forEach(layer => {
      // Basemap starts ON, overlays start OFF
      layer.visible = layer.type === 'basemap';
    });
    // Find the basemap layer item ---
    const basemap = this.layersByPlanet[planet].find(
      layer => layer.type === 'basemap'
    );
    // Update basemap source + visibility ---
    if (basemap) {
      this.baseLayer.setSource(
        new ImageStatic({
          url: this.getBasemapUrl(planet),
          imageExtent: this.globalExtent,
          projection: 'IAU2000:49900'
        })
      );
      this.baseLayer.setVisible(basemap.visible);
    }
    // Force redraw (helps when switching projections/images) ---
    this.map.render();
  }

  // --- 4. LAYER TOGGLING ---
  toggleLayer(layer: LayerItem) {
    if (layer.type === 'basemap') {
      this.baseLayer.setVisible(layer.visible);
      return;
    }


    // overlays (existing logic)
    if (layer.visible) {
      if (!this.olOverlays[layer.id]) {
        const overlay = new ImageLayer({
          zIndex: 1,
          source: new ImageStatic({
            url: this.getOverlayUrl(layer.id),
            imageExtent: this.globalExtent,
            projection: 'IAU2000:49900'
          })
        });
        this.olOverlays[layer.id] = overlay;
        this.map.addLayer(overlay);
      }
      this.olOverlays[layer.id].setVisible(true);
    } else if (this.olOverlays[layer.id]) {
      this.olOverlays[layer.id].setVisible(false);
    }
  }

  // --- 5. HELPERS ---
  private getBasemapUrl(planet: Planet): string {
    const basemaps: Record<Planet, string> = {
      earth: '/assets/earth/earth-base.png',
      mars: '/assets/mars/mars-base.png',
      moon: '/assets/moon/moon-base.png'
    };
    return basemaps[planet];
  }

  private getOverlayUrl(id: string): string {
    const overlays: Record<string, string> = {
      'mola': '/assets/mars/mola.png',
      'themis': '/assets/mars/themis.png',
      'earth-clouds': '/assets/earth/clouds.png',
      'earth-topo': '/assets/earth/topo.png',
      'lroc': '/assets/moon/lroc.png'
    };
    return overlays[id] || '';
  }

  get layers(): LayerItem[] {
    return this.layersByPlanet[this.currentPlanet];
  }

  private getProjectionForPlanet(planet: Planet): string {
    switch (planet) {
      case 'earth':
        return 'EPSG:4326';
      case 'moon':
        return 'IAU2000:30100'; // Moon
      case 'mars':
        return 'IAU2000:49900';
    }
  }
}
export { Map };

