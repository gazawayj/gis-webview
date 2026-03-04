import { Component, ElementRef, ViewChild, AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, TemplateRef, ViewContainerRef, inject, NgZone } from '@angular/core';
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
import { AIAnalysisPlugin } from './tools/ai-analysis.plugin';
import { HttpClient } from '@angular/common/http';
import { LayerDistanceToolPlugin } from './tools/layer-distance-tool.plugin';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, LayerItemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})
export class MapComponent implements AfterViewInit {

  // ===================== VIEWCHILDREN =====================
  @ViewChild('aiPromptTextarea') aiPromptTextarea?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('addLayerModal') addLayerModal!: TemplateRef<any>;
  @ViewChild('pluginSaveModal') pluginSaveModal!: TemplateRef<any>;
  @ViewChild('aiFeatureFindModal') aiFeatureFindModal!: TemplateRef<any>;
  @ViewChild('layerDistanceModal') distanceModalTemplate!: TemplateRef<any>;

  // ===================== STATE =====================
  aiPrompt = '';
  private aiModalRef?: OverlayRef;

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

  isLoading = false;
  loadingMessage = 'Loading...';

  private dragOrder: LayerConfig[] = [];
  toolList: ToolType[] = [];

  // Distance tool selections
  distanceLayerA?: LayerConfig;
  distanceLayerB?: LayerConfig;
  distanceValue = 0;

  // ===================== SERVICES =====================
  public mapFacade = inject(MapFacadeService);
  private layerManager = inject(LayerManagerService);
  public toolService = inject(ToolService);
  private cdr = inject(ChangeDetectorRef);
  private vcr = inject(ViewContainerRef);
  private modalFactory = inject(ModalFactoryService);
  private http = inject(HttpClient);
  private zone = inject(NgZone);

  private modalRef?: OverlayRef;
  private pluginModalRef?: OverlayRef;

  // ===================== GETTERS =====================
  get regularTools(): ToolDefinition[] { return this.toolService.regularTools; }
  get aiTools(): ToolDefinition[] { return this.toolService.aiTools; }
  get sidebarLayers(): LayerConfig[] {
    if (!this.dragOrder.length) this.updateDragOrder();
    return this.dragOrder;
  }

  get formattedLon(): string {
    const abs = Math.abs(this.currentLon).toFixed(4);
    return `${abs}° ${this.currentLon >= 0 ? 'E' : 'W'}`;
  }

  get formattedLat(): string {
    const abs = Math.abs(this.currentLat).toFixed(4);
    return `${abs}° ${this.currentLat >= 0 ? 'N' : 'S'}`;
  }

  get formattedDistance(): string {
    if (this.distanceValue < 1000) return `${this.distanceValue.toFixed(2)} m`;
    return `${(this.distanceValue / 1000).toFixed(2)} km`;
  }

  // ===================== LIFECYCLE =====================
  ngAfterViewInit(): void {
    this.mapFacade.initMap(this.mapContainer.nativeElement, this.currentPlanet);
    this.updateDragOrder();

    // Subscribe to loading state
    this.layerManager.loading$.subscribe(isLoading => { this.isLoading = isLoading; this.detect(); });
    this.layerManager.loadingMessage$.subscribe(message => { this.loadingMessage = message || 'Loading...'; this.detect(); });

    const viewport = this.mapFacade.map.getViewport();
    viewport.addEventListener('contextmenu', (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (this.mapFacade.getActivePlugin()) this.openPluginSaveModal();
    });

    this.toolService.activeTool$.subscribe(tool => this.activateToolFromService(tool));

    this.mapFacade.trackPointer((lon, lat, zoom) => {
      this.currentLon = lon;
      this.currentLat = lat;
      this.zoomDisplay = zoom.toFixed(2);
      this.updateLabels();
      this.detect();
    });
  }

  // ===================== TOOL ACTIVATION =====================
  private activateToolFromService(tool: ToolType): void {
    this.closeToolbox();

    try {
      if (!tool || tool === 'none') {
        this.mapFacade.activateTool(undefined as any);
        this.toolList = [];
        return;
      }

      const plugin = this.toolService.createPlugin(tool, this.layerManager, this.http);
      if (!plugin) {
        this.mapFacade.activateTool(undefined as any);
        this.toolList = [];
        return;
      }

      // **Activate the plugin with the map** (this was missing!)
      plugin.activate(this.mapFacade.map);

      this.mapFacade.activateTool(plugin);
      this.toolList = [tool];

      // Open modals as needed for specific tools
      if (tool === 'ai-analysis') this.openAiFeatureFindModal();
      if (tool === 'layer-distance') this.openLayerDistanceModal(plugin as LayerDistanceToolPlugin);
    } finally {
      this.detect();
    }
  }

  activateTool(tool: ToolType): void { this.toolService.setActiveTool(tool); }

  private updateDragOrder(): void { this.dragOrder = [...this.layerManager.getLayersForPlanet(this.currentPlanet)]; }

  onLayerDropped(event: CdkDragDrop<LayerConfig[]>): void {
    const newOrder = [...this.sidebarLayers];
    moveItemInArray(newOrder, event.previousIndex, event.currentIndex);
    this.dragOrder = newOrder;
    this.layerManager.reorderLayers(newOrder);
    this.detect();
  }

  toggleLayer(layer: LayerConfig): void { this.layerManager.toggle(layer); this.detect(); }
  removeLayer(layer: LayerConfig): void { this.layerManager.remove(layer); this.updateDragOrder(); this.detect(); }

  onColorPicked(layer: LayerConfig, color: string): void {
    layer.color = color;
    this.layerManager.updateStyle(layer);
  }

  selectShape(layer: LayerConfig, shape: ShapeType): void {
    layer.shape = shape;
    this.layerManager.styleService.setLayerShape(layer.id, shape);
    this.layerManager.updateStyle(layer);
  }

  setPlanet(planet: 'earth' | 'moon' | 'mars'): void {
    if (planet === this.currentPlanet) return;
    this.currentPlanet = planet;
    this.mapFacade.setPlanet(planet);
    this.closeToolbox();
    this.updateLabels();
    this.updateDragOrder();
    this.detect();
  }

  private updateLabels(): void {
    switch (this.currentPlanet) {
      case 'moon': this.lonLabel = 'Selenographic Longitude'; this.latLabel = 'Selenographic Latitude'; break;
      case 'mars': this.lonLabel = 'Areographic Longitude'; this.latLabel = 'Areographic Latitude'; break;
      default: this.lonLabel = 'Longitude'; this.latLabel = 'Latitude';
    }
  }

  closeToolbox(): void { this.toolService.clearTool(); }

  // ===================== ADD LAYER MODAL =====================
  onAddLayer(): void {
    this.modalMode = 'manual';
    this.modalTitle = 'Add New Manual Layer';
    this.newLayerName = '';
    this.newLayerDescription = '';
    this.modalRef = this.modalFactory.open({ template: this.addLayerModal, vcr: this.vcr });
  }

  closeAddLayer(): void { if (this.modalRef) this.modalFactory.close(this.modalRef); }
  cancelAddLayer(): void { this.closeAddLayer(); }

  // ===================== PLUGIN SAVE MODAL =====================
  openPluginSaveModal(): void {
    const activePlugin = this.mapFacade.getActivePlugin();
    const now = new Date();
    this.pluginLayerName = `${activePlugin?.name || 'Layer'}_${now.getTime()}`;
    this.pluginModalRef = this.modalFactory.open({
      template: this.pluginSaveModal,
      vcr: this.vcr,
      panelClass: 'layer-modal',
      width: '440px'
    });
    this.detect();
  }

  closePluginSaveModal(): void { if (this.pluginModalRef) this.modalFactory.close(this.pluginModalRef); }

  confirmSavePlugin(name?: string): void {
    const layerName = name?.trim() || this.pluginLayerName;
    const pluginLayer = this.mapFacade.saveByActivePlugin(layerName);
    if (pluginLayer) {
      this.layerManager.styleService.setLayerShape(pluginLayer.id, pluginLayer.shape);
      this.updateDragOrder();
    }
    this.toolService.clearTool();
    this.closePluginSaveModal();
    this.detect();
  }

  cancelPluginSave(): void {
    this.mapFacade.cancelActivePlugin();
    this.toolService.clearTool();
    this.closePluginSaveModal();
  }

  handleAiKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (this.aiPrompt.trim()) this.confirmAiFeatureFind();
    }
  }

  // ===================== AI FEATURE FIND =====================
  openAiFeatureFindModal(): void {
    this.aiPrompt = '';
    this.zone.runOutsideAngular(() => {
      this.aiModalRef = this.modalFactory.open({
        template: this.aiFeatureFindModal,
        vcr: this.vcr,
        panelClass: 'layer-modal',
        width: '420px'
      });
      setTimeout(() => this.aiPromptTextarea?.nativeElement.focus(), 0);
    });
    this.detect();
  }

  cancelAiFeatureFind(): void {
    if (this.aiModalRef) this.modalFactory.close(this.aiModalRef);
    this.mapFacade.cancelActivePlugin();
    this.toolService.clearTool();
  }

  async confirmAiFeatureFind(): Promise<void> {
    const prompt = this.aiPrompt.trim();
    if (!prompt) return;

    const plugin = this.mapFacade.getActivePlugin() as AIAnalysisPlugin | undefined;
    if (!plugin) return;

    try {
      if (this.aiModalRef) this.modalFactory.close(this.aiModalRef);
      await plugin.execute(prompt);
      this.updateDragOrder();
    } catch (err) {
      console.error('AI Feature Find failed', err);
      this.showNotification('AI Feature Find failed. See console for details.');
    } finally {
      this.mapFacade.cancelActivePlugin();
      this.toolService.clearTool();
    }
    this.detect();
  }

  // ===================== LAYER DISTANCE TOOL =====================
  onDistanceLayerChange(): void {
    const plugin = this.mapFacade.getActivePlugin() as LayerDistanceToolPlugin | undefined;
    if (!plugin) return;

    plugin.selectedLayers = [this.distanceLayerA || null, this.distanceLayerB || null];

    if (this.distanceLayerA && this.distanceLayerB) {
      this.distanceValue = plugin.computeDistance(this.distanceLayerA, this.distanceLayerB);
    } else {
      this.distanceValue = 0;
    }

    this.detect();
  }

  private openLayerDistanceModal(plugin: LayerDistanceToolPlugin): void {
    const pointLayers = this.layerManager.getLayersForPlanet(this.currentPlanet)
      .filter(l => !l.isBasemap && !l.isTemporary);

    if (pointLayers.length < 2) {
      this.showNotification('At least two layers are required to measure distance.');
      this.toolService.clearTool();
      return;
    }

    this.distanceLayerA = pointLayers[0];
    this.distanceLayerB = pointLayers[1];
    plugin.selectedLayers = [this.distanceLayerA, this.distanceLayerB];

    this.mapFacade.activateTool(plugin);
    plugin.tempSource?.clear();

    plugin.modalRef = this.modalFactory.open({
      template: this.distanceModalTemplate,
      vcr: this.vcr,
      panelClass: 'layer-modal',
      width: '440px'
    });

    plugin.onConfirmComplete = () => {
      this.updateDragOrder();
      this.detect();
      if (plugin.modalRef) this.modalFactory.close(plugin.modalRef);
      this.distanceLayerA = undefined;
      this.distanceLayerB = undefined;
      this.distanceValue = 0;
      this.toolService.clearTool();
    };

    this.onDistanceLayerChange();
    this.detect();
  }

  public confirmLayerDistance(): void {
    const plugin = this.mapFacade.getActivePlugin() as LayerDistanceToolPlugin | undefined;
    plugin?.confirm();
    this.cancelLayerDistance();
  }

  cancelLayerDistance(plugin?: LayerDistanceToolPlugin): void {
    const activePlugin = plugin || this.mapFacade.getActivePlugin() as LayerDistanceToolPlugin;
    if (!activePlugin) return;
    if (activePlugin.modalRef) this.modalFactory.close(activePlugin.modalRef);
    this.distanceLayerA = undefined;
    this.distanceLayerB = undefined;
    this.distanceValue = 0;
    this.toolService.clearTool();
    this.detect();
  }

  trackLayer(index: number, layer: LayerConfig): string { return layer.id; }

  // ===================== UTILITIES =====================
  private detect(): void { this.cdr.detectChanges(); }

  private showNotification(message: string): void {
    // Placeholder for UI notification (can be replaced with toast/snackbar)
    console.warn('Notification:', message);
  }
}