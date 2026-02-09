import { Injectable, signal, WritableSignal, computed } from '@angular/core';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import XYZ from 'ol/source/XYZ';
import OSM from 'ol/source/OSM';
import GeoJSON from 'ol/format/GeoJSON';
import { ScaleLine } from 'ol/control';
import { fromLonLat, toLonLat } from 'ol/proj';
import { Fill, Stroke, Style } from 'ol/style';
import proj4 from 'proj4';
import { register } from 'ol/proj/proj4';
import { HttpClient } from '@angular/common/http';
import { take } from 'rxjs/operators';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

export type Planet = 'earth' | 'mars' | 'moon';

export interface LayerItem {
  id: string;
  name: string;
  description?: string;
  visible: boolean;
  type: 'basemap' | 'overlay' | 'vector' | 'raster';
  zIndex: number;
  color?: string;
  source?: string;
  olLayer?: TileLayer<XYZ> | VectorLayer;
}

// Register Mars/Moon projections
proj4.defs('IAU:49900', '+proj=longlat +a=3396190 +b=3376200 +no_defs +type=crs');
proj4.defs('IAU:30100', '+proj=longlat +a=1737400 +b=1737400 +no_defs +type=crs');
register(proj4);

const FLY_TO_PRESETS: Record<Planet, { zoom: number; duration: number }> = {
  earth: { zoom: 10, duration: 2200 },
  mars: { zoom: 3, duration: 1400 },
  moon: { zoom: 3, duration: 1400 }
};

const PLANET_PROJECTIONS: Record<Planet, string> = {
  earth: 'EPSG:3857',
  mars: 'IAU:49900',
  moon: 'IAU:30100'
};

@Injectable({ providedIn: 'root' })
export class MapService {
  private mapInstance = signal<Map | null>(null);
  readonly map = this.mapInstance.asReadonly();

  private readonly loadingInternal = signal<boolean>(false);
  readonly isLoading = this.loadingInternal.asReadonly();

  terminalLines: WritableSignal<string[]> = signal([]);

  readonly planetStates = signal<Record<Planet, LayerItem[]>>({
    earth: [
      { id: 'precip', name: 'Global Precipitation', visible: false, type: 'overlay', zIndex: 4 },
      { id: 'temp', name: 'Land Surface Temp', visible: false, type: 'overlay', zIndex: 3 },
      { id: 'clouds', name: 'Cloud Fraction', visible: false, type: 'overlay', zIndex: 2 },
      { id: 'fires', name: 'Active Fires', visible: false, type: 'overlay', zIndex: 1 },
      { id: 'earth-base', name: 'Earth Basemap', visible: true, type: 'basemap', zIndex: 0 }
    ],
    mars: [
      { id: 'mars-base', name: 'Mars Basemap', visible: true, type: 'basemap', zIndex: 0 }
    ],
    moon: [
      { id: 'lroc', name: 'LROC Details', visible: false, type: 'overlay', zIndex: 1 },
      { id: 'moon-base', name: 'Moon Basemap', visible: true, type: 'basemap', zIndex: 0 }
    ]
  });

  readonly currentPlanet: WritableSignal<Planet> = signal('earth');

  private baseLayer = new TileLayer({ source: new OSM(), properties: { id: 'base' } });

  zoomDisplay: WritableSignal<string> = signal('2.0');
  currentLon: WritableSignal<string> = signal('0.00°');
  currentLat: WritableSignal<string> = signal('0.00°');

  readonly visibleLayers = computed(() => {
    const planet = this.currentPlanet();
    return this.planetStates()[planet] || [];
  });

  private readonly BASEMAP_URLS: Record<Planet, string> = {
    earth: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    mars: 'https://mars-gis.netlify.app/tiles/{z}/{x}/{y}.png',
    moon: 'https://moon-gis.netlify.app/tiles/{z}/{x}/{y}.png'
  };

  constructor(private http: HttpClient) {}

  initMap(target: HTMLElement, scaleContainer: HTMLDivElement): Map {
    const instance = new Map({
      target,
      controls: [new ScaleLine({ target: scaleContainer, units: 'metric' })],
      layers: [this.baseLayer],
      view: new View({ center: fromLonLat([0, 0]), zoom: 2 })
    });

    instance.on('moveend', () => {
      const zoom = instance.getView().getZoom();
      this.zoomDisplay.set(zoom ? zoom.toFixed(1) : '2.0');
    });

    instance.on('pointermove', (evt) => {
      if (evt.coordinate) {
        const projection = instance.getView().getProjection();
        const lonLat = projection.getCode() === 'EPSG:3857' ? toLonLat(evt.coordinate) : evt.coordinate;
        this.currentLon.set(`${lonLat[0].toFixed(4)}°`);
        this.currentLat.set(`${lonLat[1].toFixed(4)}°`);
      }
    });

    this.mapInstance.set(instance);
    return instance;
  }

  setPlanet(planet: Planet) {
    const map = this.map();
    if (!map) return;
    const projection = PLANET_PROJECTIONS['earth'];
    map.setView(new View({ center: [0, 0], zoom: 2, projection }));
    this.baseLayer.setSource(new XYZ({ url: this.BASEMAP_URLS[planet], crossOrigin: 'anonymous' }));
    this.currentPlanet.set(planet);
    this.refreshLayers(planet);
  }

  addLayer(layer: LayerItem, planet: Planet) {
    const map = this.map();
    if (!map) return;

    const exists = this.planetStates()[planet].some(l => l.id === layer.id);
    if (exists) return;

    let olLayer: TileLayer<XYZ> | VectorLayer;

    if (layer.type === 'vector') {
      const vectorSource = new VectorSource();
      olLayer = new VectorLayer({
        source: vectorSource,
        visible: layer.visible,
        style: new Style({
          fill: new Fill({ color: layer.color || 'rgba(255,0,0,0.3)' }),
          stroke: new Stroke({ color: layer.color || 'red', width: 2 })
        })
      });
      map.addLayer(olLayer);
      layer.olLayer = olLayer;

      if (layer.source) {
        this.http.get(layer.source, { responseType: 'json' })
          .pipe(take(1))
          .subscribe((data: any) => {
            const features = new GeoJSON().readFeatures(data, {
              featureProjection: map.getView().getProjection()
            });
            vectorSource.addFeatures(features);
          });
      }

    } else {
      olLayer = new TileLayer({
        source: new XYZ({ url: layer.source || this.BASEMAP_URLS[planet], crossOrigin: 'anonymous' }),
        visible: layer.visible
      });
      map.addLayer(olLayer);
      layer.olLayer = olLayer;
    }

    this.planetStates.update(prev => ({
      ...prev,
      [planet]: [...prev[planet], layer]
    }));
  }

  toggleLayer(layer: LayerItem) {
    const map = this.map();
    if (!map) return;
    const newState = !layer.visible;
    layer.olLayer?.setVisible(newState);
    const planet = this.currentPlanet();
    this.planetStates.update(prev => ({
      ...prev,
      [planet]: prev[planet].map(l => (l.id === layer.id ? { ...l, visible: newState } : l))
    }));
  }

  reorderLayers(event: CdkDragDrop<LayerItem[]>) {
    const planet = this.currentPlanet();
    const layers = [...this.planetStates()[planet]];
    moveItemInArray(layers, event.previousIndex, event.currentIndex);
    layers.forEach((layer, idx) => layer.olLayer?.setZIndex(layers.length - idx));
    this.planetStates.update(prev => ({ ...prev, [planet]: layers }));
  }

  createManualLayer(layer: Partial<LayerItem>) {
    const newLayer: LayerItem = {
      id: layer.id || `layer-${Date.now()}`,
      name: layer.name || 'New Layer',
      visible: layer.visible ?? true,
      type: layer.type || 'vector',
      zIndex: layer.zIndex || 1,
      color: layer.color,
      source: layer.source
    };
    this.addLayer(newLayer, this.currentPlanet());
  }

  refreshLayers(planet: Planet = this.currentPlanet()) {
    const map = this.map();
    if (!map) return;

    map.getLayers().getArray()
      .filter(l => l !== this.baseLayer)
      .forEach(l => map.removeLayer(l));

    this.planetStates()[planet].forEach(layer => {
      if (!layer.olLayer) this.addLayer(layer, planet);
      else map.addLayer(layer.olLayer);
      layer.olLayer?.setVisible(layer.visible);
    });
  }

  handleTerminalCommand(event: KeyboardEvent) {
    const value = (event.target as HTMLInputElement).value;
    if (!value) return;
    this.terminalLines.set([...this.terminalLines(), value]);
    (event.target as HTMLInputElement).value = '';
  }
}
