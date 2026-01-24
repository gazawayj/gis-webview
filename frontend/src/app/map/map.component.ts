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

  layersByPlanet: Record<Planet, LayerItem[]> = {
    earth: [
      { id: 'continent', name: 'Continent Outline of Earth', description: 'Layer showing the boundaries of the continents.', visible: false }
    ],
    mars: [
      { id: 'mola', name: 'MOLA Elevation', description: 'Global Mars elevation data derived from MGS MOLA. Useful for terrain and slope analysis.', visible: false },
      { id: 'imagery', name: 'THEMIS Imagery', description: 'High-resolution orbital imagery for surface feature inspection.', visible: false }
    ],
    moon: [
      { id: 'imagery', name: 'LROC Details', description: 'High-res lunar camera data.', visible: false }
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

    // Clear existing overlays and reset checkboxes
    Object.values(this.olOverlays).forEach(layer => this.map.removeLayer(layer));
    this.olOverlays = {};
    this.layersByPlanet[planet].forEach(l => l.visible = false);

    // Update Basemap Source
    this.baseLayer.setSource(new ImageStatic({
      url: this.getBasemapUrl(planet),
      imageExtent: this.globalExtent,
      projection: 'IAU2000:49900'
    }));
  }

  // --- 4. LAYER TOGGLING ---
  toggleLayer(layer: LayerItem) {
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
}
export { Map };

