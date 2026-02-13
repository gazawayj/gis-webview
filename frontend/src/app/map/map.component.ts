import { Component, ElementRef, NgZone, OnInit, AfterViewInit, ViewChild, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
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
import Feature, { FeatureLike } from 'ol/Feature';
import Point from 'ol/geom/Point';

import { Style, Circle as CircleStyle, Fill, Stroke, RegularShape, Icon } from 'ol/style';

import Papa, { ParseResult } from 'papaparse';
import { LayerItemComponent } from '../layer-item.component';

export interface LayerConfig {
  id: string;
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
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  planetState: Record<string, LayerConfig[]> = {};

  zoomDisplay = 2;
  currentLon = 0;
  currentLat = 0;

  isLoading = false;
  loadingMessage = '';

  showAddLayerModal = false;
  newLayerName = '';
  newLayerDescription = '';

  private shapeCache: Record<string, Style> = {};
  private styleFnCache: Record<string, (feature: FeatureLike, resolution: number) => Style> = {};
  private loadedCSV: Record<string, boolean> = {};

  readonly BASEMAP_URLS: Record<'earth' | 'moon' | 'mars', string> = {
    earth: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    moon: 'https://moon-gis.netlify.app/tiles/{z}/{x}/{y}.png',
    mars: 'https://mars-gis.netlify.app/tiles/{z}/{x}/{y}.png'
  };

  planetLayers: Record<string, LayerConfig[]> = {
    earth: [
      { id: 'basemap', name: 'Basemap', description: 'Earth basemap from ArcGIS Online', visible: true, color: '#3498db', shape: 'circle' },
      { id: 'firms', name: 'NASA FIRMS Fires (24h)', description: 'Fire alerts for the last 24 hours.', visible: true, color: '', shape: '', isCSV: true, source: 'https://gis-webview.onrender.com/firms', latField: 'latitude', lonField: 'longitude' },
      { id: 'usgs', name: 'USGS Earthquakes (24h)', description: 'Earthquakes past 24h', visible: true, color: '', shape: '', isCSV: true, source: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.csv', latField: 'latitude', lonField: 'longitude' }
    ],
    moon: [
      { id: 'moon-basemap', name: 'Basemap', description: 'Moon surface', visible: true, color: '#3498db', shape: 'circle' }
    ],
    mars: [
      { id: 'mars-basemap', name: 'Basemap', description: 'Mars surface', visible: true, color: '#3498db', shape: 'circle' }
    ]
  };

  COLOR_PALETTE = ['#3498db', '#e74c3c', '#f1c40f', '#2ecc71', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'];
  availableShapes = ['circle', 'square', 'triangle', 'diamond', 'pentagon', 'hexagon', 'star', 'arrow'];

  layerMap: Record<string, VectorLayer<VectorSource>> = {};

  constructor(private ngZone: NgZone, private cdr: ChangeDetectorRef, private http: HttpClient) { }

  // =========================
  // UNIQUE COLOR+SHAPE LOGIC
  // =========================
  private pickUniqueColorShape(usedCombos: Set<string>): { color: string; shape: string } {
    const maxAttempts = 100;
    let attempts = 0;
    let color: string, shape: string, key: string;

    do {
      color = this.COLOR_PALETTE[Math.floor(Math.random() * this.COLOR_PALETTE.length)];
      shape = this.availableShapes[Math.floor(Math.random() * this.availableShapes.length)];
      key = `${color}-${shape}`;
      attempts++;
    } while (usedCombos.has(key) && attempts < maxAttempts);

    return { color, shape };
  }

  // =========================
  // ngOnInit
  // =========================
  ngOnInit(): void {
    Object.keys(this.planetLayers).forEach(planet => {
      const layers = this.planetLayers[planet];

      const usedCombos = new Set<string>();
      const initializedLayers: LayerConfig[] = layers.map(layer => {
        // If stored in planetState, reuse combo
        const existing = this.planetState[planet]?.find(l => l.id === layer.id);
        if (existing) {
          usedCombos.add(`${existing.color}-${existing.shape}`);
          return { ...layer, color: existing.color, shape: existing.shape };
        }

        // Otherwise pick unique combo
        const { color, shape } = this.pickUniqueColorShape(usedCombos);
        usedCombos.add(`${color}-${shape}`);
        return { ...layer, color, shape, visible: true };
      });

      this.planetState[planet] = initializedLayers;
    });
  }

  ngAfterViewInit(): void {
    this.baseLayer = new TileLayer({ source: new XYZ({ url: this.BASEMAP_URLS[this.currentPlanet] }), visible: true });

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
        this.currentLon = +lon.toFixed(6);
        this.currentLat = +lat.toFixed(6);
        this.zoomDisplay = +(view.getZoom() ?? 2).toFixed(2);
        this.cdr.detectChanges();
      });
    });

    this.loadPlanetLayers(this.currentPlanet);
  }

  // ================= PLANET =================
  setPlanet(planet: 'earth' | 'moon' | 'mars') {
    if (planet === this.currentPlanet) return;
    this.currentPlanet = planet;
    this.baseLayer.setSource(new XYZ({ url: this.BASEMAP_URLS[planet] }));
    this.loadPlanetLayers(planet);
    this.map.getView().setCenter(fromLonLat([0, 0]));
    this.map.getView().setZoom(2);
  }

  // ================= LAYERS =================
  toggleLayer(layer: LayerConfig) {
    layer.visible = !layer.visible;
    this.layerMap[layer.id]?.setVisible(layer.visible);
    this.persistLayerState(layer);
  }

  removeLayer(layer: LayerConfig) {
    this.layers = this.layers.filter(l => l !== layer);
    const olLayer = this.layerMap[layer.id];
    if (olLayer) this.map.removeLayer(olLayer);
    delete this.layerMap[layer.id];

    const planetLayers = this.planetState[this.currentPlanet];
    const idx = planetLayers.findIndex(l => l.id === layer.id);
    if (idx !== -1) planetLayers[idx].visible = false;
  }

  onAddLayer() {
    this.newLayerName = '';
    this.newLayerDescription = '';
    this.showAddLayerModal = true;
  }

  confirmAddLayer() {
    if (!this.newLayerName.trim()) return;

    // Track used combos on current planet
    const assignedCombos = new Set(this.planetState[this.currentPlanet].map(l => `${l.color}-${l.shape}`));
    const { color, shape } = this.pickUniqueColorShape(assignedCombos);
    assignedCombos.add(`${color}-${shape}`);

    const newLayer: LayerConfig = {
      id: crypto.randomUUID(),
      name: this.newLayerName.trim(),
      description: this.newLayerDescription.trim(),
      visible: true,
      color,
      shape
    };

    this.planetState[this.currentPlanet].push(newLayer);
    this.layers.push(newLayer);
    this.addVectorLayer(newLayer);
    this.showAddLayerModal = false;
  }

  cancelAddLayer() { this.showAddLayerModal = false; }

  // ================= PLANET LAYER LOADER =================
  private loadPlanetLayers(planet: 'earth' | 'moon' | 'mars') {
    this.layers = [];
    Object.values(this.layerMap).forEach(l => this.map.removeLayer(l));
    this.layerMap = {};

    const planetLayerList = this.planetState[planet];
    const assignedCombos = new Set<string>();

    planetLayerList.forEach(layer => {
      // Ensure unique combo
      if (!layer.color || !layer.shape || assignedCombos.has(`${layer.color}-${layer.shape}`)) {
        const { color, shape } = this.pickUniqueColorShape(assignedCombos);
        layer.color = color;
        layer.shape = shape;
      }
      assignedCombos.add(`${layer.color}-${layer.shape}`);

      if (layer.visible === false && layer.isCSV) return;

      if (layer.isCSV) {
        if (!this.loadedCSV[layer.id]) {
          this.loadCSVLayer(layer);
          this.loadedCSV[layer.id] = true;
        }
      } else {
        this.addVectorLayer(layer);
      }

      if (layer.name !== 'Basemap' && layer.visible !== false) this.layers.push(layer);
    });
  }

  // ================= CSV LOADING =================
  loadCSVLayer(layer: LayerConfig) {
    if (!layer.source) return;

    const vectorSource = new VectorSource();
    const vectorLayer = new VectorLayer({
      source: vectorSource,
      visible: layer.visible,
      style: this.getStyleFunction(layer)
    });

    this.layerMap[layer.id] = vectorLayer;
    this.map.addLayer(vectorLayer);

    this.isLoading = true;
    this.loadingMessage = `Loading ${layer.name}...`;
    this.cdr.detectChanges();

    this.http.get(layer.source, { responseType: 'text' }).pipe(take(1)).subscribe({
      next: (csvData: string) => {
        const parsed: ParseResult<any> = Papa.parse(csvData, { header: true, skipEmptyLines: true });
        parsed.data.forEach(row => {
          const lat = parseFloat(row[layer.latField || 'latitude'] || row['Latitude'] || row['LAT']);
          const lon = parseFloat(row[layer.lonField || 'longitude'] || row['Longitude'] || row['LON']);
          if (!isNaN(lat) && !isNaN(lon)) vectorSource.addFeature(new Feature({ geometry: new Point(fromLonLat([lon, lat])) }));
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

  // ================= STYLES =================
  private getStyleFunction(layer: LayerConfig) {
    const key = `${layer.shape}-${layer.color}`;
    if (!this.shapeCache[key]) {
      let imageStyle;
      switch (layer.shape.toLowerCase()) {
        case 'square': imageStyle = new RegularShape({ points: 4, radius: 5, angle: Math.PI / 4, fill: new Fill({ color: layer.color }), stroke: new Stroke({ color: '#000', width: 1 }) }); break;
        case 'triangle': imageStyle = new RegularShape({ points: 3, radius: 6, fill: new Fill({ color: layer.color }), stroke: new Stroke({ color: '#000', width: 1 }) }); break;
        case 'diamond': imageStyle = new RegularShape({ points: 4, radius: 5, angle: 0, fill: new Fill({ color: layer.color }), stroke: new Stroke({ color: '#000', width: 1 }) }); break;
        case 'pentagon': imageStyle = new RegularShape({ points: 5, radius: 6, fill: new Fill({ color: layer.color }), stroke: new Stroke({ color: '#000', width: 1 }) }); break;
        case 'hexagon': imageStyle = new RegularShape({ points: 6, radius: 6, fill: new Fill({ color: layer.color }), stroke: new Stroke({ color: '#000', width: 1 }) }); break;
        case 'star': imageStyle = new RegularShape({ points: 5, radius: 6, radius2: 3, angle: 0, fill: new Fill({ color: layer.color }), stroke: new Stroke({ color: '#000', width: 1 }) }); break;
        case 'arrow': imageStyle = new Icon({ src: 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><polygon points="10,2 16,10 12,10 12,18 8,18 8,10 4,10" fill="${layer.color}" stroke="black"/></svg>`), scale: 1, anchor: [0.5, 0.5] }); break;
        default: imageStyle = new CircleStyle({ radius: 5, fill: new Fill({ color: layer.color }), stroke: new Stroke({ color: '#000', width: 1 }) });
      }
      this.shapeCache[key] = new Style({ image: imageStyle });
    }
    return this.shapeCache[key];
  }

  getStyle(color: string, shape: string): Style {
    const key = `${shape}-${color}`;
    if (!this.shapeCache[key]) {
      return this.getStyleFunction({ color, shape } as LayerConfig);
    }
    return this.shapeCache[key];
  }

  updateLayerStyle(layer: LayerConfig) { this.layerMap[layer.id]?.setStyle(this.getStyleFunction(layer)); }

  onColorPicked(layer: LayerConfig, color: string) {
    layer.color = color;
    this.updateLayerStyle(layer);
    this.persistLayerState(layer);
  }

  selectShape(layer: LayerConfig, shape: string) {
    layer.shape = shape;
    this.updateLayerStyle(layer);
    this.persistLayerState(layer);
  }

  persistLayerState(layer: LayerConfig) {
    const planetLayers = this.planetState[this.currentPlanet];
    const idx = planetLayers.findIndex(l => l.id === layer.id);
    if (idx !== -1) planetLayers[idx] = { ...layer };
    else planetLayers.push({ ...layer });
  }

  addVectorLayer(layer: LayerConfig) {
    const vectorLayer = new VectorLayer({ source: new VectorSource(), visible: layer.visible, style: this.getStyleFunction(layer) });
    this.layerMap[layer.id] = vectorLayer;
    this.map.addLayer(vectorLayer);
  }

  // ================= DRAG & DROP =================
  trackLayer(index: number, layer: LayerConfig) { return layer.id; }

  onLayerDropped(event: CdkDragDrop<LayerConfig[]>) {
    moveItemInArray(this.layers, event.previousIndex, event.currentIndex);
    this.layers.forEach((layer, index) => this.layerMap[layer.id]?.setZIndex(index + 1));

    const planetLayers = this.planetState[this.currentPlanet];
    const basemap = planetLayers.find(l => l.name === 'Basemap');
    this.planetState[this.currentPlanet] = basemap ? [basemap, ...this.layers] : [...this.layers];
  }

  // ================= COORDS =================
  get lonLabel(): string { return 'Longitude'; }
  get latLabel(): string { return 'Latitude'; }
  get formattedLon(): string { const abs = Math.abs(this.currentLon).toFixed(4); const dir = this.currentLon >= 0 ? 'E' : 'W'; return `${abs}° ${dir}`; }
  get formattedLat(): string { const abs = Math.abs(this.currentLat).toFixed(4); const dir = this.currentLat >= 0 ? 'N' : 'S'; return `${abs}° ${dir}`; }

}
