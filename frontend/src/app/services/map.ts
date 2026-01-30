import { Injectable, signal, computed } from '@angular/core';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat, toLonLat } from 'ol/proj';
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
  readonly OVERLAY_URLS: Record<string, string> = {
    lroc: 'https://gibs.earthdata.nasa.gov/LRO_WAC_Mosaic/default/2014-01-01/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg',
    fires: 'https://gibs.earthdata.nasa.gov{z}/{y}/{x}.png',
    clouds: 'https://gibs.earthdata.nasa.gov{z}/{y}/{x}.png',
    temp: 'https://gibs.earthdata.nasa.gov{z}/{y}/{x}.png',
    precip: 'https://gibs.earthdata.nasa.gov{z}/{y}/{x}.png'
  };
  private mapInstance = signal<Map | null>(null);
  readonly map = this.mapInstance.asReadonly();

  private readonly loadingInternal = signal<boolean>(false);
  readonly isLoading = this.loadingInternal.asReadonly();


  readonly planetStates = signal<Record<Planet, LayerItem[]>>({
    earth: [
      { id: 'precip', name: 'Global Precipitation', description: 'GPM Near Real-Time rain/snow rates', visible: false, type: 'overlay', zIndex: 4 },
      { id: 'temp', name: 'Land Surface Temp', description: 'MODIS/Terra daily surface temperature', visible: false, type: 'overlay', zIndex: 3 },
      { id: 'clouds', name: 'Cloud Fraction', description: 'Daily cloud cover percentage', visible: false, type: 'overlay', zIndex: 2 },
      { id: 'fires', name: 'Active Fires', description: 'MODIS thermal anomalies (24hr)', visible: false, type: 'overlay', zIndex: 1 },
      { id: 'earth-base', name: 'Earth Basemap', description: 'Global surface imagery', visible: true, type: 'basemap', zIndex: 0 }
    ],
    mars: [
      { id: 'mars-base', name: 'Mars Basemap', description: 'Global Mars reference', visible: true, type: 'basemap', zIndex: 0 }
    ],
    moon: [
      { id: 'lroc', name: 'LROC Details', description: 'High-res lunar imagery', visible: false, type: 'overlay', zIndex: 1 },
      { id: 'moon-base', name: 'Moon Basemap', description: 'Global lunar reference', visible: true, type: 'basemap', zIndex: 0 }
    ]
  });

  // UI-only properties
  private _zoomDisplay = signal<string>('2.0');
  public zoomDisplay = this._zoomDisplay.asReadonly();

  private _currentLon = signal<string>('0.00°');
  public currentLon = this._currentLon.asReadonly();

  private _currentLat = signal<string>('0.00°');
  public currentLat = this._currentLat.asReadonly();

  readonly currentPlanet = signal<'earth' | 'mars' | 'moon'>('earth');

  readonly visibleLayers = computed(() => {
    const planet = this.currentPlanet();
    return this.planetStates()[planet] || [];
  });

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

  public updateLayerZIndex(layerId: string, zIndex: number): void {
    const mapInstance = this.map(); // Assuming this is your signal or variable for ol/Map
    if (!mapInstance) return;

    // Search the Map's layer collection for the layer with the matching ID
    const targetLayer = mapInstance
      .getLayers()
      .getArray()
      .find((layer) => layer.get('id') === layerId);

    if (targetLayer) {
      targetLayer.setZIndex(zIndex);
    }
  }

  toggleLayer(layer: LayerItem): void {
    const map = this.mapInstance();
    if (!map) return;

    const newState = !layer.visible;

    if (layer.type === 'basemap') {
      // Logic for basemap: find the internal 'base' layer
      const base = map.getLayers().getArray().find(l => l.get('id') === 'base');
      base?.setVisible(newState);
    } else {
      // Logic for overlays
      const url = this.OVERLAY_URLS[layer.id];
      let targetLayer = map.getLayers().getArray().find(l => l.get('id') === layer.id);

      if (!targetLayer && url) {
        targetLayer = new TileLayer({
          source: new XYZ({ url, crossOrigin: 'anonymous' }),
          properties: { id: layer.id },
          zIndex: layer.zIndex
        });
        map.addLayer(targetLayer);
      }
      targetLayer?.setVisible(newState);
    }

    // Single source for state updates
    this.planetStates.update(prev => {
      const cur = this.currentPlanet();
      const updated = prev[cur].map(l => l.id === layer.id ? { ...l, visible: newState } : l);
      return { ...prev, [cur]: updated };
    });
  }

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

    instance.on('moveend', () => {
      const zoom = instance.getView().getZoom();
      this._zoomDisplay.set(zoom ? zoom.toFixed(1) : '2.0');
    });

    instance.on('pointermove', (evt) => {
      if (evt.coordinate) {
        const projection = instance.getView().getProjection();
        const lonLat = projection.getCode() === 'EPSG:3857'
          ? toLonLat(evt.coordinate)
          : evt.coordinate;

        const lon = lonLat[0];
        const lat = lonLat[1];

        // Combine Decimal and DMS for the UI
        this._currentLon.set(`${lon.toFixed(4)}° (${this.formatDMS(lon, false)})`);
        this._currentLat.set(`${lat.toFixed(4)}° (${this.formatDMS(lat, true)})`);
      }
    });


    instance.on('loadstart', () => this.loadingInternal.set(true));
    instance.on('loadend', () => this.loadingInternal.set(false));
    this.mapInstance.set(instance);
    return instance;
  }

  reorderLayers(newOrder: LayerItem[]): void {
    const planet = this.currentPlanet();
    const map = this.mapInstance();
    if (!map) return;

    const total = newOrder.length;
    const updatedLayers = newOrder.map((layer, index) => ({
      ...layer,
      zIndex: total - index
    }));

    // Apply to OpenLayers layers
    const olLayers = map.getLayers().getArray();
    updatedLayers.forEach(layer => {
      const target = olLayers.find(l => l.get('id') === layer.id || l.get('id') === 'base');
      if (target) {
        target.setZIndex(layer.zIndex);
      }
    });

    // Update the signal state
    this.planetStates.update(prev => ({ ...prev, [planet]: updatedLayers }));
  }

  setPlanet(planet: Planet): void {
    const mapInstance = this.map();
    if (!mapInstance) return;

    // Determine the CRS Code
    let projectionCode = 'EPSG:3857'; // Earth (Web Mercator)
    if (planet === 'mars') projectionCode = 'IAU:49900';
    if (planet === 'moon') projectionCode = 'IAU:30100';

    // Create a new View with the specific Planetary Projection
    mapInstance.setView(new View({
      projection: projectionCode,
      center: [0, 0],
      zoom: 2,
      extent: planet === 'earth' ? undefined : [-180, -90, 180, 90]
    }));

    // Update state signals
    const source = this.getBasemapSource(planet);
    this.baseLayer.setSource(source);

    this.currentPlanet.set(planet);
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
      maxZoom: planet === 'earth' ? 17 : 12
    });
  }

  private formatDMS(deg: number, isLat: boolean): string {
    const absDeg = Math.abs(deg);
    const d = Math.floor(absDeg);
    const m = Math.floor((absDeg - d) * 60);
    const s = ((absDeg - d - m / 60) * 3600).toFixed(1);
    const direction = deg >= 0
      ? (isLat ? 'N' : 'E')
      : (isLat ? 'S' : 'W');

    return `${d}°${m}'${s}" ${direction}`;
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

