import { Component, ElementRef, NgZone, OnInit, AfterViewInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { take } from 'rxjs';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import { fromLonLat, toLonLat } from 'ol/proj';
import { defaults as defaultControls } from 'ol/control';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { Style, Circle as CircleStyle, Fill, Stroke, RegularShape } from 'ol/style';
import Papa, { ParseResult } from 'papaparse';

export interface LayerConfig {
  name: string;
  description: string;
  visible: boolean;
  color?: string;
  shape?: string;
  isDropdownOpen?: boolean;
  isCSV?: boolean;
  source?: string;
  latField?: string;
  lonField?: string;
}

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, HttpClientModule],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})
export class MapComponent implements OnInit, AfterViewInit {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  constructor(private ngZone: NgZone, private cdr: ChangeDetectorRef, private http: HttpClient) {}

  map!: Map;
  baseLayer!: TileLayer<XYZ>;
  layers: LayerConfig[] = [];
  currentPlanet: 'earth' | 'moon' | 'mars' = 'earth';
  zoomDisplay = 2;
  currentLon = 0;
  currentLat = 0;
  isLoading = false;
  loadingMessage = '';
  availableShapes: string[] = ['circle', 'square', 'triangle', 'diamond', 'pentagon', 'hexagon', 'star'];

  planetLayers: Record<string, LayerConfig[]> = {
    earth: [
      { name: 'Basemap', description: 'Earth basemap from ArcGIS Online', visible: true, color: '#3498db', shape: 'circle' },
      { name: 'FIRMS', description: 'Fire alerts', visible: true, color: '#e74c3c', shape: 'circle', isCSV: true, source: 'https://gis-webview.onrender.com/firms', latField: 'latitude', lonField: 'longitude' },
      { name: 'USGS Earthquakes (24h)', description: 'Earthquakes past 24h', visible: false, color: '#f1c40f', shape: 'circle', isCSV: true, source: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.csv', latField: 'latitude', lonField: 'longitude' },
    ],
    moon: [
      { name: 'Basemap', description: 'Moon surface', visible: true, color: '#aaa', shape: 'circle' },
    ],
    mars: [
      { name: 'Basemap', description: 'Mars surface', visible: true, color: '#d35400', shape: 'circle' },
    ]
  };

  layerMap: Record<string, VectorLayer<VectorSource>> = {};

  readonly BASEMAP_URLS: Record<'earth' | 'moon' | 'mars', string> = {
    earth: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    moon: 'https://moon-gis.netlify.app/tiles/{z}/{x}/{y}.png',
    mars: 'https://mars-gis.netlify.app/tiles/{z}/{x}/{y}.png'
  };

  ngOnInit(): void {
    // Only vector layers go into UI layer list; basemap excluded
    this.layers = this.planetLayers[this.currentPlanet].filter(l => l.name !== 'Basemap');
  }

  ngAfterViewInit(): void {
    // Basemap layer always visible, never in UI
    this.baseLayer = new TileLayer({
      source: new XYZ({ url: this.BASEMAP_URLS[this.currentPlanet] }),
      visible: true
    });

    this.map = new Map({
      target: this.mapContainer.nativeElement,
      layers: [this.baseLayer],
      view: new View({ center: fromLonLat([0, 0]), zoom: 2 }),
      controls: defaultControls()
    });

    const view = this.map.getView();

    // Live stats on pointer move
    this.map.on('pointermove', (evt: any) => {
      const coord = evt.coordinate;
      if (!coord) return;
      this.ngZone.run(() => {
        const [lon, lat] = toLonLat(coord);
        this.currentLon = parseFloat(lon.toFixed(6));
        this.currentLat = parseFloat(lat.toFixed(6));
        this.zoomDisplay = parseFloat((view.getZoom() ?? 2).toFixed(2));
        this.cdr.detectChanges();
      });
    });

    // Load vector layers for current planet
    this.layers.forEach(layer => {
      if (layer.isCSV) this.loadCSVLayer(layer);
    });
  }

  setPlanet(planet: 'earth' | 'moon' | 'mars'): void {
    if (planet === this.currentPlanet) return;
    this.currentPlanet = planet;

    // Update basemap
    this.baseLayer.setSource(new XYZ({ url: this.BASEMAP_URLS[planet] }));

    // Remove existing vector layers
    Object.values(this.layerMap).forEach(l => this.map.removeLayer(l));
    this.layerMap = {};

    // Reload planet's vector layers (exclude basemap)
    this.layers = this.planetLayers[planet].filter(l => l.name !== 'Basemap');
    this.layers.forEach(layer => {
      if (layer.isCSV) this.loadCSVLayer(layer);
    });

    this.map.getView().setCenter(fromLonLat([0, 0]));
    this.map.getView().setZoom(2);
  }

  toggleLayer(layer: LayerConfig) {
    layer.visible = !layer.visible;
    const olLayer = this.layerMap[layer.name];
    if (olLayer) olLayer.setVisible(layer.visible);
  }

  loadCSVLayer(layer: LayerConfig) {
    const vectorSource = new VectorSource();
    const vectorLayer = new VectorLayer({
      source: vectorSource,
      visible: layer.visible,
      style: new Style({
        image: new CircleStyle({
          radius: 5,
          fill: new Fill({ color: layer.color ?? '#FF0000' }),
          stroke: new Stroke({ color: '#000', width: 1 })
        })
      })
    });
    
    this.layerMap[layer.name] = vectorLayer;
    this.map.addLayer(vectorLayer);

    if (!layer.source) return;

    this.isLoading = true;
    this.loadingMessage = `Loading ${layer.name}...`;

    this.http.get(layer.source, { responseType: 'text' }).pipe(take(1)).subscribe({
      next: (csvData: string) => {
        const parsed: ParseResult<any> = Papa.parse(csvData, { header: true, skipEmptyLines: true });
        parsed.data.forEach(row => {
          const lat = parseFloat(row[layer.latField || 'latitude']);
          const lon = parseFloat(row[layer.lonField || 'longitude']);
          if (!isNaN(lat) && !isNaN(lon)) {
            vectorSource.addFeature(new Feature({ geometry: new Point(fromLonLat([lon, lat])) }));
          }
        });
        this.isLoading = false;
        this.loadingMessage = '';
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error(`Error loading ${layer.name}:`, err);
        this.isLoading = false;
        this.loadingMessage = '';
        this.cdr.detectChanges();
      }
    });
  }

  updateLayerStyle(layer: LayerConfig) {
    const olLayer = this.layerMap[layer.name];
    if (!olLayer) return;

    const features = olLayer.getSource()?.getFeatures() ?? [];
    const color = layer.color ?? '#FF0000';
    const shape = layer.shape ?? 'circle';

    features.forEach(f => {
      let imageStyle;
      switch (shape) {
        case 'square':
          imageStyle = new RegularShape({ points: 4, radius: 5, angle: Math.PI / 4, fill: new Fill({ color }), stroke: new Stroke({ color: '#000', width: 1 }) });
          break;
        case 'triangle':
          imageStyle = new RegularShape({ points: 3, radius: 6, fill: new Fill({ color }), stroke: new Stroke({ color: '#000', width: 1 }) });
          break;
        default:
          imageStyle = new CircleStyle({ radius: 5, fill: new Fill({ color }), stroke: new Stroke({ color: '#000', width: 1 }) });
      }
      f.setStyle(new Style({ image: imageStyle }));
    });
  }

  toggleShapeDropdown(layer: LayerConfig) {
    layer.isDropdownOpen = !layer.isDropdownOpen;
  }

  selectShape(layer: LayerConfig, shape: string) {
    layer.shape = shape;
    layer.isDropdownOpen = false;
    this.updateLayerStyle(layer);
  }

  removeLayer(layer: LayerConfig) {
    this.layers = this.layers.filter(l => l !== layer);
    const olLayer = this.layerMap[layer.name];
    if (olLayer) this.map.removeLayer(olLayer);
    delete this.layerMap[layer.name];
  }

  onAddLayer() {
    const newLayer: LayerConfig = {
      name: 'New Layer',
      description: 'Custom layer',
      visible: true,
      color: '#2ecc71',
      shape: 'circle'
    };
    this.layers.push(newLayer);
  }

  onLayerDropped(event: CdkDragDrop<LayerConfig[]>) {
    moveItemInArray(this.layers, event.previousIndex, event.currentIndex);
    this.layers.forEach((layer, index) => {
      const olLayer = this.layerMap[layer.name];
      if (olLayer) olLayer.setZIndex(index);
    });
  }
}
