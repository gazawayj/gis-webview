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
import { AIAnalysisPlugin } from '../tools/ai-analysis.plugin';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, LayerItemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})
export class MapComponent implements AfterViewInit {

  @ViewChild('aiPromptTextarea') aiPromptTextarea?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('addLayerModal') addLayerModal!: TemplateRef<any>;
  @ViewChild('pluginSaveModal') pluginSaveModal!: TemplateRef<any>;
  @ViewChild('aiFeatureFindModal') aiFeatureFindModal!: TemplateRef<any>;

  aiPrompt = '';
  private aiModalRef!: OverlayRef;
  aiResults: Array<{ name: string; lon: number; lat: number; selected: boolean }> = [];

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

  private dragOrder: LayerConfig[] = [];
  toolList: ToolType[] = [];

  private mapFacade = inject(MapFacadeService);
  private layerManager = inject(LayerManagerService);
  private toolService = inject(ToolService);
  private cdr = inject(ChangeDetectorRef);
  private vcr = inject(ViewContainerRef);
  private modalFactory = inject(ModalFactoryService);
  private http = inject(HttpClient);

  private modalRef!: OverlayRef;
  private pluginModalRef!: OverlayRef;

  get regularTools(): ToolDefinition[] { return this.toolService.regularTools; }
  get aiTools(): ToolDefinition[] { return this.toolService.aiTools; }
  get sidebarLayers(): LayerConfig[] { if (!this.dragOrder.length) this.updateDragOrder(); return this.dragOrder; }

  get formattedLon(): string {
    const abs = Math.abs(this.currentLon).toFixed(4);
    return `${abs}° ${this.currentLon >= 0 ? 'E' : 'W'}`;
  }

  get formattedLat(): string {
    const abs = Math.abs(this.currentLat).toFixed(4);
    return `${abs}° ${this.currentLat >= 0 ? 'N' : 'S'}`;
  }

  ngAfterViewInit() {
    this.mapFacade.initMap(this.mapContainer.nativeElement, this.currentPlanet);
    this.updateDragOrder();

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
      this.cdr.detectChanges();
    });
  }

  private activateToolFromService(tool: ToolType) {
    this.closeSidebar();

    if (!tool || tool === 'none') {
      this.mapFacade.activateTool(undefined as any);
      this.toolList = [];
      this.cdr.detectChanges();
      return;
    }

    const plugin = this.toolService.createPlugin(tool, this.layerManager, this.http);
    if (plugin) {
      this.mapFacade.activateTool(plugin);
      this.toolList = [tool];
      if (tool === 'ai-analysis') this.openAiFeatureFindModal();
    } else {
      this.mapFacade.activateTool(undefined as any);
      this.toolList = [];
    }

    this.cdr.detectChanges();
  }

  activateTool(tool: ToolType) { this.toolService.setActiveTool(tool); }

  private updateDragOrder() { this.dragOrder = [...this.layerManager.getLayersForPlanet(this.currentPlanet)]; }

  onLayerDropped(event: CdkDragDrop<LayerConfig[]>) {
    const newOrder = [...this.sidebarLayers];
    moveItemInArray(newOrder, event.previousIndex, event.currentIndex);
    this.dragOrder = newOrder;
    this.layerManager.reorderLayers(newOrder);
    this.cdr.detectChanges();
  }

  toggleLayer(layer: LayerConfig) { this.layerManager.toggle(layer); this.cdr.detectChanges(); }
  removeLayer(layer: LayerConfig) { this.layerManager.remove(layer); this.updateDragOrder(); this.cdr.detectChanges(); }

  onColorPicked(layer: LayerConfig, color: string) {
    layer.color = color;
    this.layerManager.updateStyle(layer);
  }

  selectShape(layer: LayerConfig, shape: ShapeType) {
    layer.shape = shape;
    this.layerManager.styleService.setLayerShape(layer.id, shape);
    this.layerManager.updateStyle(layer);
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
      case 'moon': this.lonLabel = 'Selenographic Longitude'; this.latLabel = 'Selenographic Latitude'; break;
      case 'mars': this.lonLabel = 'Areographic Longitude'; this.latLabel = 'Areographic Latitude'; break;
      default: this.lonLabel = 'Longitude'; this.latLabel = 'Latitude';
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
    this.modalRef = this.modalFactory.open({ template: this.addLayerModal, vcr: this.vcr });
  }
  closeAddLayer() { this.modalFactory.close(this.modalRef); }
  cancelAddLayer() { this.closeAddLayer(); }

  // ---------- PLUGIN SAVE ----------
  openPluginSaveModal() {
    const activePlugin = this.mapFacade.getActivePlugin();
    const now = new Date();
    this.pluginLayerName = `${activePlugin?.name || 'Layer'}_${now.getTime()}`;
    this.pluginModalRef = this.modalFactory.open({ template: this.pluginSaveModal, vcr: this.vcr, panelClass: 'layer-modal', width: '440px' });
    this.cdr.detectChanges();
  }
  closePluginSaveModal() { if (this.pluginModalRef) this.modalFactory.close(this.pluginModalRef); }

  confirmSavePlugin(name?: string) {
    const layerName = name?.trim() || this.pluginLayerName;
    const pluginLayer = this.mapFacade.saveByActivePlugin(layerName);
    if (pluginLayer) {
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

  handleAiKeydown(event: KeyboardEvent) {
    // Enter triggers search unless Shift+Enter
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault(); // Prevent newline
      if (this.aiPrompt.trim()) this.confirmAiFeatureFind();
    }
  }

  // ---------- AI FEATURE FIND ----------
  openAiFeatureFindModal() {
    this.aiPrompt = '';
    this.aiModalRef = this.modalFactory.open({
      template: this.aiFeatureFindModal,
      vcr: this.vcr,
      panelClass: 'layer-modal',
      width: '420px'
    });

    this.cdr.detectChanges();

    // Focus textarea after modal renders
    setTimeout(() => this.aiPromptTextarea?.nativeElement.focus(), 0);
  }

  cancelAiFeatureFind() {
    if (this.aiModalRef) this.modalFactory.close(this.aiModalRef);
    this.mapFacade.cancelActivePlugin();
    this.toolService.clearTool();
  }

  async confirmAiFeatureFind() {
  if (this.aiModalRef) this.modalFactory.close(this.aiModalRef);

  const prompt = this.aiPrompt.trim();
  if (!prompt) return;

  const activePlugin = this.mapFacade.getActivePlugin() as AIAnalysisPlugin;
  if (!activePlugin) return;

  this.isLoading = true;
  this.cdr.detectChanges(); // show spinner immediately

  try {
    const results = await activePlugin.runAIQuery(prompt);
    this.aiResults = (Array.isArray(results) ? results : [results]).map(r => ({ ...r, selected: true }));

    const selectedCoords: [number, number][] = this.aiResults
      .filter(r => r.selected && r.lat !== undefined && r.lon !== undefined)
      .map(r => [r.lon, r.lat]);

    if (selectedCoords.length) activePlugin.addPoints(selectedCoords);
    if (selectedCoords.length) activePlugin.onSave({ name: `AI_${Date.now()}` });
    this.updateDragOrder();
  } catch (err) {
    console.error('AI Feature Find failed', err);
  } finally {
    this.isLoading = false;
    this.cdr.detectChanges(); // hide spinner
    this.mapFacade.cancelActivePlugin();
    this.toolService.clearTool();
  }
}

  trackLayer(index: number, layer: LayerConfig): string { return layer.id; }
}