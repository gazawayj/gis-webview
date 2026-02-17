import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  TemplateRef,
  ViewContainerRef
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';

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

  @ViewChild('addLayerModal') addLayerModal!: TemplateRef<any>;

  currentPlanet: 'earth' | 'moon' | 'mars' = 'earth';

  zoomDisplay = '2';
  lonLabel = 'Lon';
  latLabel = 'Lat';
  currentLon = 0;
  currentLat = 0;

  isLoading = false;
  loadingMessage = '';

  /** Modal state */
  modalMode: 'menu' | 'manual' | 'console' = 'menu';

  /** Manual input fields */
  newLayerName = '';
  newLayerDescription = '';
  sourceType: 'CSV' | 'GeoJSON' = 'CSV';
  sourceUrl = '';
  latField = 'latitude';
  lonField = 'longitude';

  public overlayRef!: OverlayRef;

  constructor(
    private mapFacade: MapFacadeService,
    private layerManager: LayerManagerService,
    private cdr: ChangeDetectorRef,
    private overlay: Overlay,
    private vcr: ViewContainerRef
  ) { }

  get sidebarLayers(): LayerConfig[] {
    return this.layerManager.layers.filter(layer => !layer.isBasemap);
  }

  ngAfterViewInit() {
    this.mapFacade.initMap(this.mapContainer.nativeElement, this.currentPlanet);
    this.layerManager.attachMap(this.mapFacade.map);

    this.mapFacade.trackPointer((lon, lat, zoom) => {
      this.currentLon = lon;
      this.currentLat = lat;
      this.zoomDisplay = zoom.toFixed(2);
      this.cdr.detectChanges();
    });

    this.layerManager.loadingLayers$.subscribe(() => {
      const layers = Array.from(this.layerManager.loadingLayers$.value);
      this.isLoading = layers.length > 0;
      this.loadingMessage = layers.length > 0 ? `Loading ${layers.join(', ')}...` : '';
      this.cdr.detectChanges();
    });

    this.layerManager.loadPlanet(this.currentPlanet);
  }

  // ===== Modal Control =====

  onAddLayer() {
    this.modalMode = 'manual';
    this.openModal();
  }

  getModalTitle(): string {
    switch (this.modalMode) {
      case 'manual':
        return 'Add New Manual Layer';
      case 'console':
        return 'Layer Console';
      default: // 'menu'
        return 'Add New Layer';
    }
  }

  openModal() {
    this.overlayRef = this.overlay.create({
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop',
      positionStrategy: this.overlay.position()
        .global()
        .centerHorizontally()
        .centerVertically(),
      scrollStrategy: this.overlay.scrollStrategies.block()
    });

    this.overlayRef.backdropClick().subscribe(() => this.closeModal());

    const portal = new TemplatePortal(this.addLayerModal, this.vcr);
    this.overlayRef.attach(portal);
  }

  closeModal() {
    if (this.overlayRef) this.overlayRef.dispose();
  }

  // ===== Manual Layer Creation =====

  createManualLayer() {
    this.layerManager.addManualLayer(
      this.currentPlanet,
      this.newLayerName,
      this.newLayerDescription
    );
    this.closeModal();
  }

  // ===== Planet Switching =====

  setPlanet(planet: 'earth' | 'moon' | 'mars') {
    if (planet === this.currentPlanet) return;
    this.currentPlanet = planet;
    this.mapFacade.setPlanet(planet);
    this.layerManager.loadPlanet(planet);
  }

  // ===== Existing Layer UI =====

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

  selectShape(layer: LayerConfig, shape: ShapeType | 'none') {
    layer.shape = shape;
    this.layerManager.updateStyle(layer);
  }

  onLayerDropped(event: CdkDragDrop<LayerConfig[]>) {
    const nonBasemapLayers = this.layerManager.layers.filter(l => !l.isBasemap);
    moveItemInArray(nonBasemapLayers, event.previousIndex, event.currentIndex);

    const basemap = this.layerManager.layers.find(l => l.isBasemap);
    this.layerManager.layers = basemap ? [basemap, ...nonBasemapLayers] : [...nonBasemapLayers];

    this.layerManager.reorderLayers(this.layerManager.layers);
    this.cdr.detectChanges();
  }

  trackLayer(index: number, layer: LayerConfig) {
    return layer.id;
  }

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