import { Component, ElementRef, ViewChild, AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, TemplateRef, ViewContainerRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { OverlayRef } from '@angular/cdk/overlay';
import { LayerItemComponent } from './layer-item.component';
import { MapFacadeService } from './services/map-facade.service';
import { LayerManagerService } from './services/layer-manager.service';
import { ToolService } from './services/tool.service';
import { ToolType, ToolDefinition } from './models/tool-definition.model';
import { ShapeType } from './constants/symbol-constants';
import { ModalFactoryService } from './factories/modal.factory';
import { LayerConfig } from './models/layer-config.model';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, LayerItemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  private dragOrder: LayerConfig[] = [];
  toolList: ToolType[] = [];

  private mapFacade = inject(MapFacadeService);
  private layerManager = inject(LayerManagerService);
  private toolService = inject(ToolService);
  private cdr = inject(ChangeDetectorRef);
  private vcr = inject(ViewContainerRef);
  private modalFactory = inject(ModalFactoryService);

  private modalRef!: OverlayRef;
  private pluginModalRef!: OverlayRef;

  get regularTools(): ToolDefinition[] { return this.toolService.regularTools; }
  get aiTools(): ToolDefinition[] { return this.toolService.aiTools; }
  get sidebarLayers(): LayerConfig[] { if (!this.dragOrder.length) this.updateDragOrder(); return this.dragOrder; }
  get formattedLon(): string { const abs = Math.abs(this.currentLon).toFixed(4); return `${abs}° ${this.currentLon >= 0 ? 'E' : 'W'}`; }
  get formattedLat(): string { const abs = Math.abs(this.currentLat).toFixed(4); return `${abs}° ${this.currentLat >= 0 ? 'N' : 'S'}`; }

  ngAfterViewInit() {
    this.mapFacade.initMap(this.mapContainer.nativeElement, this.currentPlanet);
    this.updateDragOrder();

    // RIGHT CLICK HANDLED HER
    const viewport = this.mapFacade.map.getViewport();

    viewport.addEventListener('contextmenu', (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (this.mapFacade.getActivePlugin()) {
        this.openPluginSaveModal();
      }
    });

    this.toolService.activeTool$.subscribe(tool => {
      this.activateToolFromService(tool);
    });

    this.mapFacade.trackPointer((lon, lat, zoom) => {
      this.currentLon = lon;
      this.currentLat = lat;
      this.zoomDisplay = zoom.toFixed(2);
      this.updateLabels();
      this.cdr.detectChanges();
    });
  }

  private activateToolFromService(tool: ToolType) {
    this.closeSidebar();

    if (tool === 'none' || !tool) {
      this.mapFacade.activateTool(undefined as any);
      this.toolList = [];
      this.cdr.detectChanges();
      return;
    }

    const plugin =
      this.toolService.tools.find(t => t.type === tool)
        ?.pluginFactory?.(this.layerManager);

    if (plugin) {
      this.mapFacade.activateTool(plugin);
      this.toolList = [tool];
    } else {
      this.mapFacade.activateTool(undefined as any);
      this.toolList = [];
    }

    this.cdr.detectChanges();
  }

  activateTool(tool: ToolType) {
    this.toolService.setActiveTool(tool);
  }

  private updateDragOrder() {
    this.dragOrder = this.layerManager.getLayersForPlanet(this.currentPlanet);
  }

  onLayerDropped(event: CdkDragDrop<LayerConfig[]>) {
    // Creat array reference so OnPush detects the change
    const newOrder = [...this.sidebarLayers];
    moveItemInArray(newOrder, event.previousIndex, event.currentIndex);
    // Update the dragOrder reference
    this.dragOrder = newOrder;
    // Update Z-index / layer ordering in the map
    this.layerManager.reorderLayers(newOrder);
    // Trigger change detection
    this.cdr.detectChanges();
  }

  toggleLayer(layer: LayerConfig) { this.layerManager.toggle(layer); this.cdr.detectChanges(); }
  removeLayer(layer: LayerConfig) { this.layerManager.remove(layer); this.updateDragOrder(); this.cdr.detectChanges(); }

  onColorPicked(layer: LayerConfig, color: string) {
    layer.color = color;
    this.layerManager.updateStyle(layer); // style pipeline handles color
  }

  selectShape(layer: LayerConfig, shape: ShapeType) {
    layer.shape = shape;
    this.layerManager.styleService.setLayerShape(layer.id, shape); // cache shape per layer
    this.layerManager.updateStyle(layer); // rerender with new style
  }

  setPlanet(planet: 'earth' | 'moon' | 'mars') {
    if (planet === this.currentPlanet) return;
    this.currentPlanet = planet;
    this.mapFacade.setPlanet(planet);
    this.closeSidebar();
    this.closeToolbox();
    this.updateLabels();
    this.updateDragOrder();
    this.cdr.detectChanges();
  }

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

  closeSidebar(): void { }
  closeToolbox() { this.toolService.clearTool(); }

  // ---------- ADD LAYER ----------
  onAddLayer() {
    this.modalMode = 'manual';
    this.modalTitle = 'Add New Manual Layer';
    this.newLayerName = '';
    this.newLayerDescription = '';
    this.latField = 'latitude';
    this.lonField = 'longitude';
    this.fileContent = null;
    this.consoleInput = '';
    this.modalRef = this.modalFactory.open({ template: this.addLayerModal, vcr: this.vcr });
  }

  closeAddLayer() { this.modalFactory.close(this.modalRef); }

  switchModalMode(mode: 'manual' | 'console') {
    this.modalMode = mode;
    this.modalTitle = mode === 'manual' ? 'Add New Manual Layer' : 'Add Layer via Console';
    this.cdr.detectChanges();
  }

  handleFileInput(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const reader = new FileReader();
    reader.onload = e => { this.fileContent = e.target?.result as string; this.cdr.detectChanges(); };
    reader.readAsText(input.files[0]);
  }

  confirmAddLayer() {
    if (!this.newLayerName.trim()) return;
    const isGeoJSON = this.fileContent?.trim().startsWith('{') || false;
    const newLayer = this.layerManager.addManualLayer(
      this.currentPlanet,
      this.newLayerName,
      this.newLayerDescription,
      this.fileContent || undefined,
      isGeoJSON ? 'GeoJSON' : 'CSV',
      this.latField,
      this.lonField
    );
    if (newLayer) this.updateDragOrder();
    this.closeAddLayer();
  }

  cancelAddLayer() { this.closeAddLayer(); }

  // ---------- PLUGIN SAVE ----------
  openPluginSaveModal() {
    if (this.pluginModalRef) this.pluginModalRef.dispose();

    const activePlugin = this.mapFacade.getActivePlugin();
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
    const toolName = activePlugin?.name.replace(/\s+/g, '_') || 'Layer';
    this.pluginLayerName = `${toolName}_${timestamp}`;

    this.pluginModalRef = this.modalFactory.open({
      template: this.pluginSaveModal,
      vcr: this.vcr,
      panelClass: 'layer-modal',
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop',
      width: '440px',
      height: '220px'
    });

    this.cdr.detectChanges();
  }

  closePluginSaveModal() {
    if (this.pluginModalRef) {
      this.modalFactory.close(this.pluginModalRef);
      this.pluginModalRef = undefined!;
      this.cdr.detectChanges();
    }
  }

  confirmSavePlugin(name?: string) {
    const layerName = name?.trim() || this.pluginLayerName;
    const pluginLayer = this.mapFacade.saveByActivePlugin(layerName);

    if (pluginLayer) {
      // ensure layer-wide shape is cached
      this.layerManager.styleService.setLayerShape(pluginLayer.id, pluginLayer.shape);
      this.updateDragOrder();
    }

    this.toolService.clearTool();
    this.closePluginSaveModal();
  }

  cancelPluginSave() {
    this.mapFacade.cancelActivePlugin();
    this.toolService.clearTool();
    this.closePluginSaveModal();
  }

  onLayerDragMoved(): void { }
  trackLayer(index: number, layer: LayerConfig): string { return layer.id; }
}
