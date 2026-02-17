import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

import { LayerItemComponent } from './layer-item.component';
import { MapFacadeService } from './services/map-facade.service';
import { LayerManagerService, LayerConfig, ShapeType } from './services/layer-manager.service';

@Component({
  selector: 'app-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, DragDropModule, LayerItemComponent],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})
export class MapComponent implements AfterViewInit {

  @ViewChild('mapContainer', { static: true })
  mapContainer!: ElementRef<HTMLDivElement>;

  currentPlanet: 'earth' | 'moon' | 'mars' = 'earth';

  // ===== UI STATE =====
  zoomDisplay = '2';
  lonLabel = 'Lon';
  latLabel = 'Lat';
  currentLon = 0;
  currentLat = 0;

  isLoading = false;
  loadingMessage = '';

  showAddLayerModal = false;
  newLayerName = '';
  newLayerDescription = '';

  constructor(
    private mapFacade: MapFacadeService,
    private layerManager: LayerManagerService,
    private cdr: ChangeDetectorRef
  ) { }

  // ===== Accessors for template =====
  get sidebarLayers(): LayerConfig[] {
    return this.layerManager.layers.filter(layer => !layer.isBasemap);
  }

  get loadingLayers$() {
    return this.layerManager.loadingLayers$;
  }

  ngAfterViewInit() {
    // Initialize the map
    this.mapFacade.initMap(this.mapContainer.nativeElement, this.currentPlanet);

    // Attach map to layer manager
    this.layerManager.attachMap(this.mapFacade.map);

    // Track pointer stats for live display
    this.mapFacade.trackPointer((lon: number, lat: number, zoom: number) => {
      this.currentLon = lon;
      this.currentLat = lat;
      this.zoomDisplay = zoom.toFixed(2);
      this.cdr.detectChanges();
    });

    // Subscribe to global loading spinner
    this.layerManager.loadingLayers$.subscribe(() => {
      const layers = Array.from(this.layerManager.loadingLayers$.value);
      this.isLoading = layers.length > 0;
      this.loadingMessage = layers.length > 0 ? `Loading ${layers.join(', ')}...` : '';
      this.cdr.detectChanges();
    });

    // Load all default layers for current planet
    this.layerManager.loadPlanet(this.currentPlanet);
  }

  // ===== Planet Switching =====
  setPlanet(planet: 'earth' | 'moon' | 'mars') {
    if (planet === this.currentPlanet) return;

    this.currentPlanet = planet;
    this.mapFacade.setPlanet(planet);
    this.layerManager.loadPlanet(planet);
  }

  // ===== Layer UI Actions =====
  onAddLayer() {
    this.showAddLayerModal = true;
  }

  confirmAddLayer() {
    this.layerManager.addManualLayer(
      this.currentPlanet,
      this.newLayerName.trim(),
      this.newLayerDescription.trim()
    );

    this.newLayerName = '';
    this.newLayerDescription = '';
    this.showAddLayerModal = false;
  }

  cancelAddLayer() {
    this.showAddLayerModal = false;
  }

  toggleLayer(layer: LayerConfig) {
    this.layerManager.toggle(layer);
  }

  removeLayer(layer: LayerConfig) {
    this.layerManager.remove(layer);
  }

  onColorPicked(layer: LayerConfig, color: string) {
    layer.color = color;
    this.layerManager.updateStyle(layer);
  }

  /** Type-safe shape selection */
  selectShape(layer: LayerConfig, shape: ShapeType | 'none') {
    layer.shape = shape;
    this.layerManager.updateStyle(layer);
  }

  // ===== Drag & Drop =====
  onLayerDropped(event: CdkDragDrop<LayerConfig[]>) {
    const nonBasemapLayers = this.layerManager.layers.filter(l => !l.isBasemap);
    moveItemInArray(nonBasemapLayers, event.previousIndex, event.currentIndex);

    const basemap = this.layerManager.layers.find(l => l.isBasemap);
    this.layerManager.layers = basemap ? [basemap, ...nonBasemapLayers] : [...nonBasemapLayers];

    this.layerManager.reorderLayers(this.layerManager.layers);
    this.layerManager.persistCurrentOrder(this.currentPlanet);
    this.cdr.detectChanges();
  }

  trackLayer(index: number, layer: LayerConfig) {
    return layer.id;
  }

  // ===== Pointer display helpers =====
  get formattedLon(): string {
    const abs = Math.abs(this.currentLon).toFixed(4);
    const dir = this.currentLon >= 0 ? 'E' : 'W';
    return `${abs}° ${dir}`;
  }

  get formattedLat(): string {
    const abs = Math.abs(this.currentLat).toFixed(4);
    const dir = this.currentLat >= 0 ? 'N' : 'S';
    return `${abs}° ${dir}`;
  }
}
