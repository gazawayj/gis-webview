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

    const extent: [number, number, number, number] =
      [-9356484.534, -2139739.1418, -1324835.2291, 14775954.5102];

    this.earthLayer = this.createLayer('./src/assets/earth/earth.png', extent, true);
    this.marsLayer  = this.createLayer('./src/assets/mars/mars.png', extent, false);
    this.moonLayer  = this.createLayer('./src/assets/moon/moon.png', extent, false); 

    this.map = new Map({
      target: this.mapContainer.nativeElement, 
      layers: [
        this.earthLayer,
        this.marsLayer,
        this.moonLayer
      ],
      view: new View({
        projection: 'EPSG:4326',
        center: [0, 0],
        zoom: 1,
        maxZoom: 5
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
        projection: 'EPSG:4326'
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

