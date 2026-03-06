import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  TemplateRef,
  ViewContainerRef,
  inject,
  NgZone
} from '@angular/core';

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
import { LayerDistanceToolPlugin } from './tools/layer-distance-tool.plugin';

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
  @ViewChild('layerDistanceModal') distanceModalTemplate!: TemplateRef<any>;

  aiPrompt = '';
  currentPlanet: 'earth' | 'moon' | 'mars' = 'earth';
  activeTool: ToolType = 'none';

  zoomDisplay = '2';
  currentLon = 0;
  currentLat = 0;

  lonLabel = 'Lon';
  latLabel = 'Lat';

  dragOrder: LayerConfig[] = [];

  distanceLayerA?: LayerConfig;
  distanceLayerB?: LayerConfig;
  distanceValue = 0;

  isLoading = false;
  loadingMessage = 'Loading...';
  pluginLayerName = '';

  private aiModalRef?: OverlayRef;
  private modalRef?: OverlayRef;
  private pluginModalRef?: OverlayRef;

  public mapFacade = inject(MapFacadeService);
  private layerManager = inject(LayerManagerService);
  public toolService = inject(ToolService);
  private modalFactory = inject(ModalFactoryService);
  private http = inject(HttpClient);
  private zone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  private vcr = inject(ViewContainerRef);

  get regularTools(): ToolDefinition[] { return this.toolService.regularTools; }
  get aiTools(): ToolDefinition[] { return this.toolService.aiTools; }

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

  ngAfterViewInit(): void {
    this.mapFacade.initMap(this.mapContainer.nativeElement, this.currentPlanet);

    this.layerManager.layers$.subscribe(layers => {
      this.dragOrder = [...layers];
      this.cdr.detectChanges();
    });

    this.toolService.activeTool$.subscribe(tool => {
      this.activeTool = tool;
      this.cdr.detectChanges();
    });

    this.layerManager.loading$.subscribe(v => {
      this.isLoading = v;
      this.cdr.detectChanges();
    });

    this.layerManager.loadingMessage$.subscribe(msg => {
      this.loadingMessage = msg || 'Loading...';
      this.cdr.detectChanges();
    });

    this.toolService.activeTool$.subscribe(tool => this.activateToolFromService(tool));
    const viewport = this.mapFacade.map.getViewport();

    viewport.addEventListener('contextmenu', e => {
      e.preventDefault();
      if (this.mapFacade.getActivePlugin()) this.openPluginSaveModal();
    });

    this.mapFacade.trackPointer((lon, lat, zoom) => {
      this.currentLon = lon;
      this.currentLat = lat;
      this.zoomDisplay = zoom.toFixed(2);
      this.updateLabels();
      this.cdr.detectChanges();
    });
  }

  private activateToolFromService(tool: ToolType): void {
    if (!tool || tool === 'none') {
      this.mapFacade.activateTool(undefined as any);
      return;
    }

    const plugin = this.toolService.createPlugin(tool, this.layerManager, this.http);
    if (!plugin) return;
    plugin.activate(this.mapFacade.map);
    this.mapFacade.activateTool(plugin);
    if (tool === 'ai-analysis') this.openAiFeatureFindModal();
    if (tool === 'layer-distance') this.openLayerDistanceModal(plugin as LayerDistanceToolPlugin);
  }

  activateTool(tool: ToolType): void {
    this.toolService.setActiveTool(tool);
  }

  onLayerDropped(event: CdkDragDrop<LayerConfig[]>): void {
    const newOrder = [...this.dragOrder];
    moveItemInArray(newOrder, event.previousIndex, event.currentIndex);
    this.dragOrder = newOrder;
    this.layerManager.reorderLayers(newOrder);
    this.cdr.detectChanges();
  }

  toggleLayer(layer: LayerConfig): void {
    this.layerManager.toggle(layer);
  }

  removeLayer(layer: LayerConfig): void {
    this.layerManager.remove(layer);
  }

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
    this.updateLabels();
    this.toolService.clearTool();
    this.cdr.detectChanges();
  }

  private updateLabels(): void {
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

  onAddLayer(): void {
    this.modalRef = this.modalFactory.open({
      template: this.addLayerModal,
      vcr: this.vcr
    });
  }

  closeAddLayer(): void {
    if (this.modalRef) this.modalFactory.close(this.modalRef);
  }

  openPluginSaveModal(): void {
    const activePlugin = this.mapFacade.getActivePlugin();
    this.pluginLayerName = `${activePlugin?.name || 'Layer'}_${Date.now()}`;
    this.pluginModalRef = this.modalFactory.open({
      template: this.pluginSaveModal,
      vcr: this.vcr,
      panelClass: 'layer-modal',
      width: '440px'
    });
  }

  closePluginSaveModal(): void {
    if (this.pluginModalRef) this.modalFactory.close(this.pluginModalRef);
  }

  confirmSavePlugin(name?: string): void {
    const layerName = name?.trim() || this.pluginLayerName;
    const layer = this.mapFacade.saveByActivePlugin(layerName);
    if (layer) {
      this.layerManager.styleService.setLayerShape(layer.id, layer.shape);
    }
    this.toolService.clearTool();
    this.closePluginSaveModal();
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

  openAiFeatureFindModal(): void {
    this.aiPrompt = '';

    this.aiModalRef = this.modalFactory.open({
      template: this.aiFeatureFindModal,
      vcr: this.vcr,
      panelClass: 'layer-modal',
      width: '420px'
    });

    // Focus the textarea reliably via DOM query
    requestAnimationFrame(() => {
      const textarea = this.aiModalRef?.overlayElement.querySelector('textarea') as HTMLTextAreaElement | null;
      if (textarea) textarea.focus();
    });
  }

  cancelAiFeatureFind(): void {
    if (this.aiModalRef) this.modalFactory.close(this.aiModalRef);
    this.mapFacade.cancelActivePlugin();
    this.toolService.clearTool();
  }

  async confirmAiFeatureFind(): Promise<void> {
    const prompt = this.aiPrompt.trim();
    if (!prompt) return;
    const plugin = this.mapFacade.getActivePlugin() as AIAnalysisPlugin;
    if (!plugin) return;
    try {
      if (this.aiModalRef) this.modalFactory.close(this.aiModalRef);
      await plugin.execute(prompt);
    } catch (err) {
      console.error('AI Feature Find failed', err);
    } finally {
      this.mapFacade.cancelActivePlugin();
      this.toolService.clearTool();
    }
  }

  onDistanceLayerChange(): void {
    const plugin = this.mapFacade.getActivePlugin() as LayerDistanceToolPlugin;
    if (!plugin) return;
    plugin.selectedLayers = [this.distanceLayerA || null, this.distanceLayerB || null];
    if (this.distanceLayerA && this.distanceLayerB) {
      this.distanceValue = plugin.computeDistance(this.distanceLayerA, this.distanceLayerB);
    } else {
      this.distanceValue = 0;
    }
    this.cdr.detectChanges();
  }

  private openLayerDistanceModal(plugin: LayerDistanceToolPlugin): void {
    const layers = this.layerManager.getLayersForPlanet(this.currentPlanet)
      .filter(l => !l.isBasemap && !l.isTemporary);
    if (layers.length < 2) {
      console.warn('At least two layers required.');
      this.toolService.clearTool();
      return;
    }
    this.distanceLayerA = layers[0];
    this.distanceLayerB = layers[1];
    plugin.selectedLayers = [this.distanceLayerA, this.distanceLayerB];
    plugin.modalRef = this.modalFactory.open({
      template: this.distanceModalTemplate,
      vcr: this.vcr,
      panelClass: 'layer-modal',
      width: '440px'
    });
    this.onDistanceLayerChange();
  }

  confirmLayerDistance(): void {
    const plugin = this.mapFacade.getActivePlugin() as LayerDistanceToolPlugin;
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
  }

  trackLayer(index: number, layer: LayerConfig): string {
    return layer.id;
  }

  trackByTool(index: number, tool: ToolDefinition): string {
    return tool.type;
  }

  isToolAvailable(toolType: string): boolean {
    if (toolType === 'highres-selection') return this.currentPlanet === 'mars';
    return true;
  }

  getToolTooltip(tool: any): string {
    if (!this.isToolAvailable(tool.type)) {
      const planet = this.currentPlanet.charAt(0).toUpperCase() + this.currentPlanet.slice(1);
      return `Not available on ${planet}`;
    }
    return tool.name;
  }
}