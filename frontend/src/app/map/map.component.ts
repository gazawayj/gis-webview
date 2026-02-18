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

import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';

@Component({
  selector: 'app-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, DragDropModule, LayerItemComponent],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})
export class MapComponent implements AfterViewInit {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('addLayerModal') addLayerModal!: TemplateRef<any>;

  currentPlanet: 'earth' | 'moon' | 'mars' = 'earth';

  zoomDisplay = '2';
  currentLon = 0;
  currentLat = 0;

  lonLabel = 'Lon';
  latLabel = 'Lat';

  isLoading = false;
  loadingMessage = '';

  modalMode: 'manual' | 'console' = 'manual';
  modalTitle = 'Add New Manual Layer';

  newLayerName = '';
  newLayerDescription = '';
  latField = 'latitude';
  lonField = 'longitude';
  fileContent: string | null = null;

  consoleInput = '';
  previewLayer: LayerConfig | null = null;
  private overlayRef!: OverlayRef;

  constructor(
    private mapFacade: MapFacadeService,
    private layerManager: LayerManagerService,
    private cdr: ChangeDetectorRef,
    private overlay: Overlay,
    private vcr: ViewContainerRef
  ) { }

  ngAfterViewInit() {
    this.mapFacade.initMap(this.mapContainer.nativeElement, this.currentPlanet);
    this.layerManager.attachMap(this.mapFacade.map);

    this.mapFacade.trackPointer((lon, lat, zoom) => {
      this.currentLon = lon;
      this.currentLat = lat;
      this.zoomDisplay = zoom.toFixed(2);
      this.updateLabels();
      this.cdr.detectChanges();
    });

    this.layerManager.loadingLayers$.subscribe(() => {
      const layers = Array.from(this.layerManager.loadingLayers$.value);
      this.isLoading = layers.length > 0;
      this.loadingMessage = layers.length > 0 ? `Loading ${layers.join(', ')}...` : '';
      this.cdr.detectChanges();
    });

    // Load default layers for the planet
    this.layerManager.loadPlanet(this.currentPlanet);
    this.updateLayerZIndexes(); // Ensure initial z-indexes are correct
  }

  private updateLabels() {
    switch (this.currentPlanet) {
      case 'earth': this.lonLabel = 'Lon'; this.latLabel = 'Lat'; break;
      case 'moon': this.lonLabel = 'Longitude'; this.latLabel = 'Latitude'; break;
      case 'mars': this.lonLabel = 'M-Longitude'; this.latLabel = 'M-Latitude'; break;
      default: this.lonLabel = 'Lon'; this.latLabel = 'Lat';
    }
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

  get sidebarLayers(): LayerConfig[] {
    return this.layerManager.layers.filter(layer => !layer.isBasemap);
  }

  trackLayer(index: number, layer: LayerConfig) {
    return layer.id;
  }

  onLayerDropped(event: CdkDragDrop<LayerConfig[]>) {
    const sidebarLayers = this.sidebarLayers.slice();
    moveItemInArray(sidebarLayers, event.previousIndex, event.currentIndex);

    this.layerManager.reorderLayers(sidebarLayers);
    this.cdr.detectChanges();
  }

  private updateLayerZIndexes() {
    let z = 1;
    this.sidebarLayers.forEach(layer => {
      layer.olLayer?.setZIndex(z);
      z++;
    });
    const basemap = this.layerManager.layers.find(l => l.isBasemap);
    if (basemap) basemap.olLayer?.setZIndex(0);
  }

  toggleLayer(layer: LayerConfig) {
    this.layerManager.toggle(layer);
    this.updateLayerZIndexes();
  }

  removeLayer(layer: LayerConfig) {
    this.layerManager.remove(layer);
    this.updateLayerZIndexes();
  }

  onColorPicked(layer: LayerConfig, color: string) {
    layer.color = color;
    this.layerManager.updateStyle(layer);
    if (this.previewLayer?.id === layer.id) this.previewLayer.color = color;
  }

  selectShape(layer: LayerConfig, shape: ShapeType | 'none') {
    layer.shape = shape;
    this.layerManager.updateStyle(layer);
    if (this.previewLayer?.id === layer.id) this.previewLayer.shape = shape;
  }

  setPlanet(planet: 'earth' | 'moon' | 'mars') {
    if (planet === this.currentPlanet) return;
    this.currentPlanet = planet;
    this.mapFacade.setPlanet(planet);
    this.layerManager.loadPlanet(planet);
    this.updateLabels();
    this.updateLayerZIndexes();
  }

  onAddLayer() {
    this.modalMode = 'manual';
    this.modalTitle = 'Add New Manual Layer';
    this.previewLayer = null;
    this.openModal();
  }

  openModal() {
    this.overlayRef = this.overlay.create({
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop',
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
      scrollStrategy: this.overlay.scrollStrategies.block()
    });
    this.overlayRef.backdropClick().subscribe(() => this.closeModal());
    this.overlayRef.attach(new TemplatePortal(this.addLayerModal, this.vcr));
    this.cdr.detectChanges();
  }

  closeModal() { this.overlayRef?.dispose(); }

  switchModalMode(mode: 'manual' | 'console') {
    this.modalMode = mode;
    this.modalTitle = mode === 'manual' ? 'Add New Manual Layer' : 'Add Layer via Console';
    this.cdr.detectChanges();
  }

  handleFileInput(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = e => {
      this.fileContent = e.target?.result as string;
      if (!this.fileContent) return;

      const { color, shape } = this.layerManager.styleService.getRandomStyleProps();
      const vectorLayer = new VectorLayer({
        source: new VectorSource(),
        style: this.layerManager.styleService.getStyle(color, shape)
      });

      // Remove previous preview layer if any
      if (this.previewLayer) {
        this.mapFacade.map.removeLayer(this.previewLayer.olLayer);
      }

      this.previewLayer = {
        id: `preview-${Date.now()}`,
        name: 'Preview Layer',
        color,
        shape,
        visible: true,
        olLayer: vectorLayer,
        latField: this.latField,
        lonField: this.lonField
      };

      // Temporarily add for preview only
      this.mapFacade.map.addLayer(vectorLayer);

      // Auto-detect GeoJSON vs CSV
      let isGeoJSON = false;
      try {
        const parsed = JSON.parse(this.fileContent);
        if (parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
          isGeoJSON = true;
          this.previewLayer.sourceType = 'GeoJSON';
          this.layerManager.loadLayerFromSource(this.previewLayer, parsed);
        }
      } catch {
        // CSV fallback
      }

      if (!isGeoJSON) {
        this.previewLayer.sourceType = 'CSV';
        this.layerManager.loadLayerFromSource(this.previewLayer, this.fileContent);
      }

      this.updateLayerZIndexes();
      this.cdr.detectChanges();
    };

    reader.readAsText(file);
  }

  confirmAddLayer() {
    if (this.modalMode === 'manual') {
      if (!this.newLayerName || !this.fileContent) return;

      // Add real layer to LayerManager
      this.layerManager.addManualLayer(
        this.currentPlanet,
        this.newLayerName,
        this.newLayerDescription,
        this.fileContent,
        this.previewLayer?.sourceType || 'CSV',
        this.latField,
        this.lonField
      );

      // Remove preview layer
      if (this.previewLayer) {
        this.mapFacade.map.removeLayer(this.previewLayer.olLayer);
        this.previewLayer = null;
      }

      this.updateLayerZIndexes();
    } else if (this.consoleInput) {
      this.layerManager.addLayerFromConsole(this.currentPlanet, this.consoleInput);
      this.updateLayerZIndexes();
    }

    this.cancelAddLayer();
  }

  cancelAddLayer() {
    // Remove preview layer if present
    if (this.previewLayer) {
      this.mapFacade.map.removeLayer(this.previewLayer.olLayer);
      this.previewLayer = null;
    }

    this.newLayerName = '';
    this.newLayerDescription = '';
    this.latField = 'latitude';
    this.lonField = 'longitude';
    this.fileContent = null;
    this.consoleInput = '';
    this.closeModal();
  }
}
