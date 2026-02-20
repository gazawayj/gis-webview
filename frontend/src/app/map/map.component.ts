import {
  Component, ElementRef, ViewChild, AfterViewInit, ChangeDetectionStrategy,
  ChangeDetectorRef, TemplateRef, ViewContainerRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { LayerItemComponent } from './layer-item.component';
import { MapFacadeService } from './services/map-facade.service';
import { LayerManagerService, LayerConfig } from './services/layer-manager.service';
import { ToolService, ToolType } from './services/tool.service';
import { ShapeType } from './services/symbol-constants';
import { toLonLat } from 'ol/proj';

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
  @ViewChild('distanceSaveModal') distanceSaveModal!: TemplateRef<any>;

  currentPlanet: 'earth' | 'moon' | 'mars' = 'earth';
  zoomDisplay = '2';
  currentLon = 0;
  currentLat = 0;
  lonLabel = 'Lon';
  latLabel = 'Lat';

  modalMode: 'manual' | 'console' = 'manual';
  modalTitle = 'Add New Manual Layer';
  newLayerName = '';
  newLayerDescription = '';
  latField = 'latitude';
  lonField = 'longitude';
  fileContent: string | null = null;
  consoleInput = '';
  distanceLayerName = '';

  private overlayRef!: OverlayRef;
  private distanceOverlayRef!: OverlayRef;
  toolList: string[] = ['Distance'];

  constructor(
    private mapFacade: MapFacadeService,
    private layerManager: LayerManagerService,
    private toolService: ToolService,
    private cdr: ChangeDetectorRef,
    private overlay: Overlay,
    private vcr: ViewContainerRef
  ) { }

  ngAfterViewInit() {
    // Initialize map and automatically load current planet (basemap + built-in layers)
    this.mapFacade.initMap(this.mapContainer.nativeElement, this.currentPlanet);

    // Distance modal trigger
    this.mapContainer.nativeElement.addEventListener('distance-save-request', () => this.openDistanceSaveModal());

    this.toolService.activeTool$.subscribe(tool => this.mapFacade.activateTool(tool));

    // Track pointer for coordinates display
    this.mapFacade.trackPointer((lon: number, lat: number, zoom: number) => {
      this.currentLon = lon;
      this.currentLat = lat;
      this.zoomDisplay = zoom.toFixed(2);
      this.updateLabels();
      this.cdr.detectChanges();
    });

    this.cdr.detectChanges();
  }

  // ================= DISTANCE MODAL =================
  openDistanceSaveModal() {
    this.distanceLayerName = `Distance-${Date.now()}`;
    this.distanceOverlayRef = this.overlay.create({
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop',
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
      scrollStrategy: this.overlay.scrollStrategies.block()
    });

    const portal = new TemplatePortal(this.distanceSaveModal, this.vcr);
    this.distanceOverlayRef.attach(portal);

    // Close and clear tool on backdrop click
    this.distanceOverlayRef.backdropClick().subscribe(() => this.cancelDistanceSave());

    this.cdr.detectChanges();
  }

  closeDistanceSaveModal() {
    this.distanceOverlayRef?.dispose();
  }

  confirmSaveDistance(name?: string) {
    const layerName = name?.trim() || `Distance-${Date.now()}`;
    this.mapFacade.saveDistanceLayer(layerName);
    this.cdr.detectChanges();
    this.cancelDistanceSave();
  }

  /** Cancels distance save and clears the tool */
  cancelDistanceSave() {
    this.mapFacade.activateTool(undefined as any); // clear distance tool
    this.closeDistanceSaveModal();
    this.cdr.detectChanges();
  }

  // ================= TOOLBOX =================
  activateTool(tool: 'distance') {
    this.mapFacade.activateTool(tool);
    this.toolList = [tool];
  }

  closeToolbox() {
    this.toolList = [];
    this.mapFacade.activateTool(undefined as any);
    this.cdr.detectChanges();
  }

  // ================= COORD LABELS =================
  private updateLabels() {
    switch (this.currentPlanet) {
      case 'moon':
        this.lonLabel = 'Longitude';
        this.latLabel = 'Latitude';
        break;
      case 'mars':
        this.lonLabel = 'M-Longitude';
        this.latLabel = 'M-Latitude';
        break;
      default:
        this.lonLabel = 'Lon';
        this.latLabel = 'Lat';
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

  // ================= SIDEBAR =================
  get sidebarLayers(): LayerConfig[] {
    return this.layerManager.layers;
  }

  trackLayer(index: number, layer: LayerConfig) {
    return layer.id;
  }

  onLayerDragMoved() {
    this.layerManager.applyZOrder();
  }

  onLayerDropped(event: CdkDragDrop<LayerConfig[]>) {
    const reordered = [...this.sidebarLayers];
    moveItemInArray(reordered, event.previousIndex, event.currentIndex);
    this.layerManager.reorderLayers(reordered);
    this.cdr.detectChanges();
  }

  toggleLayer(layer: LayerConfig) {
    this.layerManager.toggle(layer);
    this.cdr.detectChanges();
  }

  removeLayer(layer: LayerConfig) {
    this.layerManager.remove(layer);
    this.cdr.detectChanges();
  }

  onColorPicked(layer: LayerConfig, color: string) {
    layer.color = color;
    this.layerManager.updateStyle(layer);
    this.cdr.detectChanges();
  }

  selectShape(layer: LayerConfig, shape: ShapeType | 'none') {
    layer.shape = shape;
    this.layerManager.updateStyle(layer);
    this.cdr.detectChanges();
  }

  // ================= PLANET SWITCH =================
  setPlanet(planet: 'earth' | 'moon' | 'mars') {
    if (planet === this.currentPlanet) return;
    this.currentPlanet = planet;

    this.layerManager.loadPlanet(planet);
    this.mapFacade.setPlanet(planet);

    this.updateLabels();
    this.cdr.detectChanges();
    this.closeToolbox();
  }

  // ================= ADD LAYER MODAL =================
  onAddLayer() {
    this.modalMode = 'manual';
    this.modalTitle = 'Add New Manual Layer';
    this.newLayerName = '';
    this.newLayerDescription = '';
    this.latField = 'latitude';
    this.lonField = 'longitude';
    this.fileContent = null;
    this.consoleInput = '';
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

  closeModal() {
    this.overlayRef?.dispose();
  }

  switchModalMode(mode: 'manual' | 'console') {
    this.modalMode = mode;
    this.modalTitle = mode === 'manual'
      ? 'Add New Manual Layer'
      : 'Add Layer via Console';
    this.cdr.detectChanges();
  }

  // ================= FILE INPUT =================
  handleFileInput(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = e => {
      this.fileContent = e.target?.result as string;
      this.cdr.detectChanges();
    };
    reader.readAsText(file);
  }

  cancelAddLayer() {
    this.closeModal();
  }

  confirmAddLayer() {
    if (!this.newLayerName.trim()) return;

    if (this.modalMode === 'manual') {
      this.layerManager.addManualLayer(
        this.currentPlanet,
        this.newLayerName,
        this.newLayerDescription,
        this.fileContent || undefined,
        this.fileContent?.trim().startsWith('{') ? 'GeoJSON' : 'CSV',
        this.latField,
        this.lonField
      );
    } else if (this.modalMode === 'console' && this.consoleInput.trim()) {
      //this.layerManager.addLayerFromConsole(this.currentPlanet, this.consoleInput);
    }

    this.closeModal();
    this.cdr.detectChanges();
  }
}
