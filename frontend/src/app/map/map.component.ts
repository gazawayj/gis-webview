import {
  Component,
  AfterViewInit,
  ViewChild,
  ElementRef
} from '@angular/core';

import Map from 'ol/Map';
import View from 'ol/View';
import ImageLayer from 'ol/layer/Image';
import ImageStatic from 'ol/source/ImageStatic';
import proj4 from 'proj4';
import { register } from 'ol/proj/proj4.js';
import { get as getProjection } from 'ol/proj.js';

@Component({
  selector: 'app-map',
  standalone: true,
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})
export class MapComponent implements AfterViewInit {

  @ViewChild('mapContainer', { static: true })
  mapContainer!: ElementRef<HTMLDivElement>;

  private map!: Map;
  private earthLayer!: ImageLayer<ImageStatic>;
  private marsLayer!: ImageLayer<ImageStatic>;
  private moonLayer!: ImageLayer<ImageStatic>;

  ngAfterViewInit(): void {

    // Define IAU2000:49900 (Mars Geographic) Projection for web map
    // a=equatorial radius, b=polar radius in meters
    proj4.defs("IAU2000:49900", "+proj=longlat +a=3396190 +b=3376200 +no_defs");
    register(proj4);

    //extent is in degrees
    const extent: [number, number, number, number] =
      [-180, -90, 180, 90];

    const marsProj = getProjection('IAU2000:49900');
    marsProj?.setExtent(extent);
    
    this.earthLayer = this.createLayer('/assets/earth/earth.png', extent, false);
    this.marsLayer  = this.createLayer('/assets/mars/mars.png', extent, true);
    this.moonLayer  = this.createLayer('/assets/moon/moon.png', extent, false); 

    this.map = new Map({
      target: this.mapContainer.nativeElement, 
      layers: [
        this.earthLayer,
        this.marsLayer,
        this.moonLayer
      ],
      view: new View({
      projection: 'IAU2000:49900',
      center: [0, 0],
      zoom: 1,
      minZoom: 1,
      maxZoom: 7,
      extent: extent
      })
    });
  }

  private createLayer(
    url: string,
    extent: [number, number, number, number],
    visible: boolean
  ): ImageLayer<ImageStatic> {

    return new ImageLayer({
      visible,
      source: new ImageStatic({
        url,
        imageExtent: extent,
        projection: 'IAU2000:49900'
      })
    });
  }

  setPlanet(planet: 'earth' | 'mars' | 'moon'): void {
    this.earthLayer.setVisible(planet === 'earth');
    this.marsLayer.setVisible(planet === 'mars');
    this.moonLayer.setVisible(planet === 'moon');
  }
}
export { Map };

