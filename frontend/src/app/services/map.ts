import { Injectable, signal } from '@angular/core';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj';
import { XYZ } from 'ol/source';
import { ScaleLine } from 'ol/control';

export interface LayerItem {
  id: string;
  name: string;
  description: string;
  visible: boolean;
  type: 'basemap' | 'overlay';
  zIndex: number;
}

export type Planet = 'earth' | 'mars' | 'moon';

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private mapInstance = signal<Map | null>(null);
  readonly map = this.mapInstance.asReadonly();

  private readonly loadingInternal = signal<boolean>(false);
  readonly isLoading = this.loadingInternal.asReadonly();


  readonly planetStates = signal<Record<Planet, LayerItem[]>>({
    earth: [{ id: 'earth-base', name: 'Earth Basemap', description: 'Global surface imagery', visible: true, type: 'basemap', zIndex: 0 }],
    mars: [{ id: 'mars-base', name: 'Mars Basemap', description: 'Global Mars reference', visible: true, type: 'basemap', zIndex: 0 }],
    moon: [
      { id: 'moon-base', name: 'Moon Basemap', description: 'Global lunar reference', visible: true, type: 'basemap', zIndex: 0 },
      { id: 'lroc', name: 'LROC Details', description: 'High-res lunar imagery', visible: false, type: 'overlay', zIndex: 1 }
    ]
  });

  readonly currentPlanet = signal<'earth' | 'mars' | 'moon'>('earth');
  readonly visibleLayers = signal<LayerItem[]>([]);

  private baseLayer = new TileLayer({
    source: new OSM(),
    properties: { id: 'base' }
  });

  private readonly planetInfo = {
    earth: { latLabel: 'Latitude', lonLabel: 'Longitude', gravity: '9.81 m/s²' },
    mars: { latLabel: 'Planetocentric Lat', lonLabel: 'Aerographic Lon', gravity: '3.72 m/s²' },
    moon: { latLabel: 'Selenographic Lat', lonLabel: 'Selenographic Lon', gravity: '1.62 m/s²' }
  };

  private planetCoordinates: Record<string, [number, number]> = {
    earth: [0, 0],
    mars: [0, 0], // MOLA center
    moon: [0, 0]  // LROC center
  };

  initMap(target: HTMLElement, scaleContainer: HTMLDivElement): Map {
    const instance = new Map({
      target: target,
      controls: [
        new ScaleLine({
          target: scaleContainer,
          units: 'metric'
        })
      ],
      layers: [this.baseLayer],
      view: new View({
        center: fromLonLat([0, 0]),
        zoom: 2,
      }),
    });

    instance.on('loadstart', () => this.loadingInternal.set(true));
    instance.on('loadend', () => this.loadingInternal.set(false));
    this.mapInstance.set(instance);
    const initial = this.sortLayers(this.planetStates().earth);
    this.visibleLayers.set(initial);

    return instance;
  }

  setPlanet(planet: Planet) {
    const map = this.mapInstance();
    if (!map) return;

    this.currentPlanet.set(planet);

    // Update the baseLayer with the new planetary URL
    this.baseLayer.setSource(this.getBasemapSource(planet));
    const sortedLayers = this.sortLayers(this.planetStates()[planet]);
    this.visibleLayers.set(sortedLayers);

    // Reset view for the new planet
    map.getView().animate({
      center: fromLonLat(this.planetCoordinates[planet]),
      zoom: 2,
      duration: 1000
    });
  }

  toggleOverlay(layer: LayerItem) {
    const map = this.mapInstance();
    if (!map) return;

    // The checkbox already changed the object's value locally
    const newState = !layer.visible;

    const layers = map.getLayers().getArray();
    let targetLayer = layers.find(l => l.get('id') === layer.id);

    // If base layer, handle differently; if overlay, handle here
    if (targetLayer) {
      targetLayer.setVisible(newState);
    }

    // Sync the Signal State
    this.planetStates.update(prev => {
      const cur = this.currentPlanet();
      const updated = prev[cur].map(l =>
        l.id === layer.id ? { ...l, visible: newState } : l
      );
      return { ...prev, [cur]: updated };
    });

    // Update visible layers for the UI
    this.visibleLayers.set(this.sortLayers(this.planetStates()[this.currentPlanet()]));
  }

  private readonly BASEMAP_URLS: Record<Planet, string> = {
    earth: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    mars: 'https://mars-gis.netlify.app/tiles/{z}/{x}/{y}.png',
    moon: 'https://moon-gis.netlify.app/tiles/{z}/{x}/{y}.png'
  };


  private getBasemapSource(planet: Planet): XYZ {
    return new XYZ({
      url: this.BASEMAP_URLS[planet],
      crossOrigin: 'anonymous', // Helps with potential CORS issues
      // Optional: Set maxZoom for planetary tiles if they are limited
      maxZoom: planet === 'earth' ? 19 : 12
    });
  }

  addLayer(layer: any) {
    this.mapInstance()?.addLayer(layer);
  }

  getPlanetInfo(planet: Planet) {
    return this.planetInfo[planet];
  }

  getPlanetStats() {
    const stats = {
      earth: { latLabel: 'Latitude', lonLabel: 'Longitude', gravity: '9.81 m/s²' },
      mars: { latLabel: 'Aerographic Lat', lonLabel: 'Aerographic Lon', gravity: '3.72 m/s²' },
      moon: { latLabel: 'Selenographic Lat', lonLabel: 'Selenographic Lon', gravity: '1.62 m/s²' }
    };
    return stats[this.currentPlanet()];
  }

  private sortLayers(layers: LayerItem[]): LayerItem[] {
    return [...layers].sort((a, b) => b.zIndex - a.zIndex);
  }
}
export { Map };

