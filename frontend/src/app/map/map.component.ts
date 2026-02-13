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
import { Style, Circle as CircleStyle, Fill, Stroke, RegularShape, Icon } from 'ol/style';
import Papa, { ParseResult } from 'papaparse';
import { LayerItemComponent } from '../layer-item.component';

export interface LayerConfig {
  name: string;
  description: string;
  visible: boolean;
  color: string;
  shape: string;
  isDropdownOpen?: boolean;
  isCSV?: boolean;
  source?: string;
  latField?: string;
  lonField?: string;
}

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, HttpClientModule, LayerItemComponent],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})
export class MapComponent implements OnInit, AfterViewInit {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  map!: Map;
  baseLayer!: TileLayer<XYZ>;
  layers: LayerConfig[] = [];
  currentPlanet: 'earth' | 'moon' | 'mars' = 'earth';
  zoomDisplay = 2;
  currentLon = 0;
  currentLat = 0;
  isLoading = false;
  loadingMessage = '';
  showAddLayerModal = false;
  newLayerName = '';
  newLayerDescription = '';

  COLOR_PALETTE = [
    '#3498db', '#e74c3c', '#f1c40f', '#2ecc71',
    '#9b59b6', '#1abc9c', '#e67e22', '#34495e',
  ];

  availableShapes: string[] = ['circle', 'square', 'triangle', 'diamond', 'pentagon', 'hexagon', 'star', 'arrow'];

  planetLayers: Record<string, Omit<LayerConfig, 'color' | 'shape' | 'visible'>[]> = {
    earth: [
      { name: 'Basemap', description: 'Earth basemap from ArcGIS Online' },
      { name: 'FIRMS', description: 'Fire alerts', isCSV: true, source: 'https://gis-webview.onrender.com/firms', latField: 'latitude', lonField: 'longitude' },
      { name: 'USGS Earthquakes (24h)', description: 'Earthquakes past 24h', isCSV: true, source: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.csv', latField: 'latitude', lonField: 'longitude' },
    ],
    moon: [
      { name: 'Basemap', description: 'Moon surface' },
    ],
    mars: [
      { name: 'Basemap', description: 'Mars surface' },
    ]
  };

  layerMap: Record<string, VectorLayer<VectorSource>> = {};
  planetState: Record<string, LayerConfig[]> = {};

  private shapeCache: Record<string, Style> = {};

  readonly BASEMAP_URLS: Record<'earth' | 'moon' | 'mars', string> = {
    earth: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    moon: 'https://moon-gis.netlify.app/tiles/{z}/{x}/{y}.png',
    mars: 'https://mars-gis.netlify.app/tiles/{z}/{x}/{y}.png'
  };

  constructor(private ngZone: NgZone, private cdr: ChangeDetectorRef, private http: HttpClient) { }

  ngOnInit(): void {
    Object.keys(this.planetLayers).forEach(planet => {
      this.planetState[planet] = this.planetLayers[planet].map(l => {
        const isBasemap = l.name === 'Basemap';
        const color = isBasemap ? '#3498db' : this.COLOR_PALETTE[Math.floor(Math.random() * this.COLOR_PALETTE.length)];
        const shape = isBasemap ? 'circle' : this.availableShapes[Math.floor(Math.random() * this.availableShapes.length)];
        const visible = isBasemap ? true : true;
        return { ...l, color, shape, visible };
      });
    });

    // Sidebar layers (exclude basemap)
    this.layers = this.planetState[this.currentPlanet].filter(l => l.name !== 'Basemap');
  }

  ngAfterViewInit(): void {
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

    // Load all CSV layers on startup
    this.layers.forEach(layer => {
      if (layer.isCSV) this.loadCSVLayer(layer);
      else this.addVectorLayer(layer);
    });
  }

  setPlanet(planet: 'earth' | 'moon' | 'mars') {
    if (planet === this.currentPlanet) return;
    this.currentPlanet = planet;

    this.baseLayer.setSource(new XYZ({ url: this.BASEMAP_URLS[planet] }));
    Object.values(this.layerMap).forEach(l => this.map.removeLayer(l));
    this.layerMap = {};

    this.layers = this.planetState[planet].filter(l => l.name !== 'Basemap');
    this.layers.forEach(layer => {
      if (layer.isCSV) this.loadCSVLayer(layer);
      else this.addVectorLayer(layer);
    });

    this.map.getView().setCenter(fromLonLat([0, 0]));
    this.map.getView().setZoom(2);
  }

  toggleLayer(layer: LayerConfig) {
    layer.visible = !layer.visible;
    const olLayer = this.layerMap[layer.name];
    if (olLayer) olLayer.setVisible(layer.visible);
    this.persistLayerState(layer);
  }

  getStyle(color: string, shape: string): Style {
    const key = `${shape}-${color}`;
    if (!this.shapeCache[key]) {
      let imageStyle;
      switch (shape.toLowerCase()) {
        case 'square':
          imageStyle = new RegularShape({ points: 4, radius: 5, angle: Math.PI / 4, fill: new Fill({ color }), stroke: new Stroke({ color: '#000', width: 1 }) });
          break;
        case 'triangle':
          imageStyle = new RegularShape({ points: 3, radius: 6, fill: new Fill({ color }), stroke: new Stroke({ color: '#000', width: 1 }) });
          break;
        case 'diamond':
          imageStyle = new RegularShape({ points: 4, radius: 5, angle: 0, fill: new Fill({ color }), stroke: new Stroke({ color: '#000', width: 1 }) });
          break;
        case 'pentagon':
          imageStyle = new RegularShape({ points: 5, radius: 6, fill: new Fill({ color }), stroke: new Stroke({ color: '#000', width: 1 }) });
          break;
        case 'hexagon':
          imageStyle = new RegularShape({ points: 6, radius: 6, fill: new Fill({ color }), stroke: new Stroke({ color: '#000', width: 1 }) });
          break;
        case 'star':
          imageStyle = new RegularShape({ points: 5, radius: 6, radius2: 3, angle: 0, fill: new Fill({ color }), stroke: new Stroke({ color: '#000', width: 1 }) });
          break;
        case 'cross':
          imageStyle = new RegularShape({ points: 4, radius: 6, radius2: 0, angle: 0, fill: new Fill({ color }), stroke: new Stroke({ color: '#000', width: 1 }) });
          break;
        case 'arrow':
          imageStyle = new Icon({
            src: 'data:image/svg+xml;utf8,' + encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">
                <polygon points="10,2 16,10 12,10 12,18 8,18 8,10 4,10" fill="${color}" stroke="black"/>
              </svg>
            `),
            scale: 1,
            anchor: [0.5, 0.5]
          });
          break;
        default:
          imageStyle = new CircleStyle({ radius: 5, fill: new Fill({ color }), stroke: new Stroke({ color: '#000', width: 1 }) });
      }
      this.shapeCache[key] = new Style({ image: imageStyle });
    }
    return this.shapeCache[key];
  }

  updateLayerStyle(layer: LayerConfig) {
    const olLayer = this.layerMap[layer.name];
    if (!olLayer) return;
    olLayer.setStyle(f => this.getStyle(layer.color, layer.shape));
  }

  addVectorLayer(layer: LayerConfig) {
    const vectorLayer = new VectorLayer({
      source: new VectorSource(),
      visible: layer.visible,
      style: f => this.getStyle(layer.color, layer.shape)
    });
    this.layerMap[layer.name] = vectorLayer;
    this.map.addLayer(vectorLayer);
  }

  loadCSVLayer(layer: LayerConfig) {
    const vectorSource = new VectorSource();
    const vectorLayer = new VectorLayer({
      source: vectorSource,
      visible: layer.visible,
      style: f => this.getStyle(layer.color, layer.shape)
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

  selectShape(layer: LayerConfig, shape: string) {
    layer.shape = shape;
    this.updateLayerStyle(layer);
    this.persistLayerState(layer);
  }

  onColorPicked(layer: LayerConfig, color: string) {
    layer.color = color;
    this.updateLayerStyle(layer);
    this.persistLayerState(layer);
  }

  removeLayer(layer: LayerConfig) {
    this.layers = this.layers.filter(l => l !== layer);
    const olLayer = this.layerMap[layer.name];
    if (olLayer) this.map.removeLayer(olLayer);
    delete this.layerMap[layer.name];
    this.persistPlanetLayers();
  }

  onAddLayer() {
    this.newLayerName = '';
    this.newLayerDescription = '';
    this.showAddLayerModal = true;
  }

  confirmAddLayer() {
    const name = this.newLayerName.trim() || 'New Layer';
    const randomColor = this.COLOR_PALETTE[Math.floor(Math.random() * this.COLOR_PALETTE.length)];
    const randomShape = this.availableShapes[Math.floor(Math.random() * this.availableShapes.length)];

    const newLayer: LayerConfig = {
      name,
      description: this.newLayerDescription || 'Custom layer',
      visible: true,
      color: randomColor,
      shape: randomShape
    };

    this.layers.push(newLayer);
    this.addVectorLayer(newLayer);
    this.persistPlanetLayers();
    this.showAddLayerModal = false;
  }

  cancelAddLayer() {
    this.showAddLayerModal = false;
  }

  persistLayerState(layer: LayerConfig) {
    const planetLayers = this.planetState[this.currentPlanet];
    const idx = planetLayers.findIndex(l => l.name === layer.name);
    if (idx !== -1) planetLayers[idx] = { ...layer };
  }

  persistPlanetLayers() {
    this.planetState[this.currentPlanet] = [
      ...this.layers,
      ...this.planetState[this.currentPlanet].filter(l => l.name === 'Basemap')
    ];
  }

  get lonLabel(): string {
    switch (this.currentPlanet) {
      case 'moon': return 'Selenographic Longitude';
      case 'mars': return 'Areographic Longitude';
      default: return 'Longitude';
    }
  }

  get latLabel(): string {
    switch (this.currentPlanet) {
      case 'moon': return 'Selenographic Latitude';
      case 'mars': return 'Areographic Latitude';
      default: return 'Latitude';
    }
  }

  get formattedLon(): string {
    const abs = Math.abs(this.currentLon).toFixed(4);
    const dir = this.currentLon >= 0 ? 'E' : 'W';
    const alt = this.currentLon.toFixed(4);
    return `${abs}° ${dir} (${alt}°)`;
  }

  get formattedLat(): string {
    const abs = Math.abs(this.currentLat).toFixed(4);
    const dir = this.currentLat >= 0 ? 'N' : 'S';
    const alt = this.currentLat.toFixed(4);
    return `${abs}° ${dir} (${alt}°)`;
  }

  onLayerDropped(event: CdkDragDrop<LayerConfig[]>) {
    moveItemInArray(this.layers, event.previousIndex, event.currentIndex);

    const allLayers = [
      ...this.planetState[this.currentPlanet].filter(l => l.name === 'Basemap'),
      ...this.layers
    ];

    allLayers.forEach((layer, index) => {
      const olLayer = this.layerMap[layer.name];
      if (olLayer) olLayer.setZIndex(index);
    });

    this.persistPlanetLayers();
  }
}
