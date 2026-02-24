import {
  Component, ElementRef, ViewChild, AfterViewInit, ChangeDetectionStrategy,
  ChangeDetectorRef, TemplateRef, ViewContainerRef
} from '@angular/core';
import { CommonModule, NgIf, NgForOf } from '@angular/common'; // <-- add NgIf, NgForOf
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { LayerItemComponent } from './layer-item.component';
import { MapFacadeService, ToolPlugin } from './services/map-facade.service';
import { LayerManagerService, LayerConfig } from './services/layer-manager.service';
import { ToolService } from './services/tool.service';
import { ShapeType } from './services/symbol-constants';
import { DistanceToolPlugin } from './tools/distance-tool.plugin';

@Component({
  selector: 'app-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, DragDropModule, LayerItemComponent, NgIf, NgForOf], // <-- fix structural directives
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})
export class MapComponent implements AfterViewInit {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('addLayerModal') addLayerModal!: TemplateRef<any>;
  @ViewChild('pluginSaveModal') pluginSaveModal!: TemplateRef<any>;

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
  pluginLayerName = '';

  private overlayRef!: OverlayRef;
  private pluginOverlayRef!: OverlayRef;
  toolList: string[] = [];
  activePanel: 'layers' | 'stats' | null = null;
  panelOpen = false;

  constructor(
    private mapFacade: MapFacadeService,
    private layerManager: LayerManagerService,
    private toolService: ToolService,
    private cdr: ChangeDetectorRef,
    private overlay: Overlay,
    private vcr: ViewContainerRef
  ) { }

  ngAfterViewInit() {
    this.mapFacade.initMap(this.mapContainer.nativeElement, this.currentPlanet);

    this.mapContainer.nativeElement.addEventListener('plugin-save-request', () => this.openPluginSaveModal());

    this.toolService.activeTool$.subscribe(tool => {
      if (tool === 'distance') {
        const plugin = new DistanceToolPlugin(this.mapFacade);
        this.mapFacade.activateTool(plugin);
      } else {
        this.mapFacade.activateTool(undefined as any);
      }
    });

    this.mapFacade.trackPointer((lon, lat, zoom) => {
      this.currentLon = lon;
      this.currentLat = lat;
      this.zoomDisplay = zoom.toFixed(2);
      this.updateLabels();
      this.cdr.detectChanges();
    });

    this.cdr.detectChanges();
  }

  // ================= PLUGIN SAVE MODAL =================
  openPluginSaveModal() {
    this.pluginLayerName = `Distance-${Date.now()}`; // default name
    this.pluginOverlayRef = this.overlay.create({
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop',
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
      scrollStrategy: this.overlay.scrollStrategies.block(),
    });

    const portal = new TemplatePortal(this.pluginSaveModal, this.vcr);
    this.pluginOverlayRef.attach(portal);

    this.pluginOverlayRef.backdropClick().subscribe(() => this.cancelPluginSave());
    this.cdr.detectChanges();
  }

  closePluginSaveModal() {
    this.pluginOverlayRef?.dispose();
  }

  confirmSavePlugin(name?: string) {
    const layerName = name?.trim() || `Distance-${Date.now()}`;
    this.mapFacade.saveActivePlugin(layerName);
    this.closePluginSaveModal();
    this.cdr.detectChanges();
  }

  cancelPluginSave() {
    this.mapFacade.cancelActivePlugin();
    this.closePluginSaveModal();
    this.cdr.detectChanges();
  }

  // ================= TOOLBOX =================
  activateTool(tool: 'distance') {
    this.closeSidebar();
    if (tool === 'distance') {
      const plugin = new DistanceToolPlugin(this.mapFacade);
      this.mapFacade.activateTool(plugin);
    }
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
        this.lonLabel = 'Selenographic Longitude';
        this.latLabel = 'Selenographic Latitude';
        break;
      case 'mars':
        this.lonLabel = 'Areographic Longitude';
        this.latLabel = 'Areographic Latitude';
        break;
      default:
        this.lonLabel = 'Longitude';
        this.latLabel = 'Latitude';
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

  togglePanel() {
  this.panelOpen = !this.panelOpen;
}

  openPanel(type: 'layers' | 'stats') {
  this.activePanel = type;
  this.panelOpen = true;
}

  closeSidebar(): void {
    this.panelOpen = false;
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
    layer.color = color;               // <--- update the LayerConfig
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
    this.mapFacade.setPlanet(planet);
    this.closeSidebar();
    this.updateLabels();
    this.closeToolbox();
    this.cdr.detectChanges();
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
      this.cdr.detectChanges();
    };
    reader.readAsText(file);
  }

  cancelAddLayer() {
    this.closeModal();
  }

  confirmAddLayer() {
    if (!this.newLayerName.trim()) return;

    this.layerManager.addManualLayer(
      this.currentPlanet,
      this.newLayerName,
      this.newLayerDescription,
      this.fileContent || undefined,
      this.fileContent?.trim().startsWith('{') ? 'GeoJSON' : 'CSV',
      this.latField,
      this.lonField
    );

    this.closeModal();
    this.cdr.detectChanges();
  }
}