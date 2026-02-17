import { Injectable, NgZone } from '@angular/core';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import { fromLonLat, toLonLat } from 'ol/proj';

@Injectable({ providedIn: 'root' })
export class MapFacadeService {

  map!: Map;
  baseLayer!: TileLayer<XYZ>;

  readonly BASEMAP_URLS = {
    earth: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    moon: 'https://moon-gis.netlify.app/tiles/{z}/{x}/{y}.png',
    mars: 'https://mars-gis.netlify.app/tiles/{z}/{x}/{y}.png'
  };

  constructor(private zone: NgZone) { }

  initMap(container: HTMLElement, planet: 'earth' | 'moon' | 'mars') {
    this.baseLayer = new TileLayer({
      source: new XYZ({ url: this.BASEMAP_URLS[planet] }),
      visible: true
    });

    this.map = new Map({
      target: container,
      layers: [this.baseLayer],
      view: new View({
        center: fromLonLat([0, 0]),
        zoom: 2
      })
    });
  }

  setPlanet(planet: 'earth' | 'moon' | 'mars') {
    this.baseLayer.setSource(new XYZ({ url: this.BASEMAP_URLS[planet] }));
    const view = this.map.getView();
    view.setCenter(fromLonLat([0, 0]));
    view.setZoom(2);
  }

  // EXACT original behavior restored
  trackPointer(callback: (lon: number, lat: number, zoom: number) => void) {

    const view = this.map.getView();

    this.map.on('pointermove', (evt: any) => {
      const coord = evt.coordinate;
      if (!coord) return;

      this.zone.run(() => {
        const [lon, lat] = toLonLat(coord);

        callback(
          +lon.toFixed(6),
          +lat.toFixed(6),
          +(view.getZoom() ?? 2).toFixed(2)
        );
      });
    });
  }
}
