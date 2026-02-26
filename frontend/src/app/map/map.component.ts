import {
  Component, ElementRef, ViewChild, AfterViewInit, ChangeDetectionStrategy,
  ChangeDetectorRef, TemplateRef, ViewContainerRef, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';

import { LayerItemComponent } from './layer-item.component';
import { MapFacadeService } from './services/map-facade.service';
import { LayerManagerService, LayerConfig } from './services/layer-manager.service';
import { ToolService } from './services/tool.service';

import { CoordinateCapturePlugin } from './tools/coordinate-capture.plugin';
import { DistanceToolPlugin } from './tools/distance-tool.plugin';
import { AreaToolPlugin } from './tools/area-tool.plugin';
import { AIAnalysisPlugin } from './tools/ai-analysis.plugin';
import { ToolType, ToolDefinition } from './models/tool-definition.model';
import { ShapeType } from './constants/symbol-constants';

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

  private overlayRef!: OverlayRef;
  private pluginOverlayRef!: OverlayRef;
  private dragOrder: LayerConfig[] = [];
  toolList: ToolType[] = [];

  // ---------- INJECTS ----------
  private mapFacade = inject(MapFacadeService);
  private layerManager = inject(LayerManagerService);
  private toolService = inject(ToolService);
  private cdr = inject(ChangeDetectorRef);
  private overlay = inject(Overlay);
  private vcr = inject(ViewContainerRef);

  // ---------- TOOL GETTERS ----------
  get regularTools(): ToolDefinition[] {
    return this.toolService.tools.filter(t => !t.type.startsWith('ai-'));
  }

  get aiTools(): ToolDefinition[] {
    return this.toolService.tools.filter(t => t.type.startsWith('ai-'));
  }

  ngAfterViewInit() {
    this.mapFacade.initMap(this.mapContainer.nativeElement, this.currentPlanet);
    this.dragOrder = this.layerManager.layers.filter(l => !l.isBasemap);

    this.mapContainer.nativeElement.addEventListener('plugin-save-request', () => this.openPluginSaveModal());

    // subscribe to the ToolService (single source of truth)
    this.toolService.activeTool$.subscribe(tool => this.activateTool(tool));

    this.mapFacade.trackPointer((lon, lat, zoom) => {
      this.currentLon = lon;
      this.currentLat = lat;
      this.zoomDisplay = zoom.toFixed(2);
      this.updateLabels();
      this.cdr.detectChanges();
    });

    this.cdr.detectChanges();
  }

  activateTool(tool: ToolType) {
    this.closeSidebar();
    switch (tool) {
      case 'coordinate': this.mapFacade.activateTool(new CoordinateCapturePlugin(this.layerManager)); break;
      case 'distance': this.mapFacade.activateTool(new DistanceToolPlugin(this.layerManager)); break;
      case 'area': this.mapFacade.activateTool(new AreaToolPlugin(this.layerManager)); break;
      default:
        if (tool.startsWith('ai-')) this.mapFacade.activateTool(new AIAnalysisPlugin(this.layerManager));
        else this.mapFacade.activateTool(undefined as any);
    }
    this.toolList = tool !== 'none' ? [tool] : [];
  }

  closeToolbox() {
    this.toolList = [];
    this.mapFacade.activateTool(undefined as any);
    this.cdr.detectChanges();
  }

  // ----------------- LAYER METHODS -----------------
  onLayerDropped(event: CdkDragDrop<LayerConfig[]>) {
    moveItemInArray(this.dragOrder, event.previousIndex, event.currentIndex);
    this.layerManager.reorderLayers(this.dragOrder);
    this.cdr.detectChanges();
  }
  onLayerDragMoved(): void { }
  trackLayer(index: number, layer: LayerConfig): string { return layer.id; }
  toggleLayer(layer: LayerConfig) { this.layerManager.toggle(layer); this.cdr.detectChanges(); }
  removeLayer(layer: LayerConfig) { this.layerManager.remove(layer); this.dragOrder = this.dragOrder.filter(l => l.id !== layer.id); this.cdr.detectChanges(); }
  onColorPicked(layer: LayerConfig, color: string) { layer.color = color; this.layerManager.updateStyle(layer); this.cdr.detectChanges(); }
  selectShape(layer: LayerConfig, shape: ShapeType | 'none') { layer.shape = shape; this.layerManager.updateStyle(layer); this.cdr.detectChanges(); }

  // ----------------- PLANET SWITCH -----------------
  setPlanet(planet: 'earth' | 'moon' | 'mars') {
    if (planet === this.currentPlanet) return;
    this.currentPlanet = planet;
    this.mapFacade.setPlanet(planet);
    this.closeSidebar();
    this.updateLabels();
    this.closeToolbox();
    this.dragOrder = this.layerManager.layers.filter(l => !l.isBasemap);
    this.cdr.detectChanges();
  }

  private updateLabels() {
    switch (this.currentPlanet) {
      case 'moon': this.lonLabel = 'Selenographic Longitude'; this.latLabel = 'Selenographic Latitude'; break;
      case 'mars': this.lonLabel = 'Areographic Longitude'; this.latLabel = 'Areographic Latitude'; break;
      default: this.lonLabel = 'Longitude'; this.latLabel = 'Latitude';
    }
  }

  get formattedLon(): string { const abs = Math.abs(this.currentLon).toFixed(4); const dir = this.currentLon >= 0 ? 'E' : 'W'; return `${abs}° ${dir}`; }
  get formattedLat(): string { const abs = Math.abs(this.currentLat).toFixed(4); const dir = this.currentLat >= 0 ? 'N' : 'S'; return `${abs}° ${dir}`; }

  // ----------------- MODALS -----------------
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
  closeModal() { this.overlayRef?.dispose(); }
  switchModalMode(mode: 'manual' | 'console') { this.modalMode = mode; this.modalTitle = mode === 'manual' ? 'Add New Manual Layer' : 'Add Layer via Console'; this.cdr.detectChanges(); }
  handleFileInput(event: Event) { const input = event.target as HTMLInputElement; if (!input.files?.length) return; const file = input.files[0]; const reader = new FileReader(); reader.onload = e => { this.fileContent = e.target?.result as string; this.cdr.detectChanges(); }; reader.readAsText(file); }
  cancelAddLayer() { this.closeModal(); }
  confirmAddLayer() { if (!this.newLayerName.trim()) return; const newLayer = this.layerManager.addManualLayer(this.currentPlanet, this.newLayerName, this.newLayerDescription, this.fileContent || undefined, this.fileContent?.trim().startsWith('{') ? 'GeoJSON' : 'CSV', this.latField, this.lonField); if (newLayer) this.dragOrder.unshift(newLayer); this.closeModal(); this.cdr.detectChanges(); }

  // ----------------- PLUGIN MODAL -----------------
  openPluginSaveModal() {
    const activePlugin = this.mapFacade.getActivePlugin();
    const pluginName = activePlugin?.name || 'Plugin';
    this.pluginLayerName = `${pluginName}-${Date.now()}`;
    this.pluginOverlayRef = this.overlay.create({
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop',
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
      scrollStrategy: this.overlay.scrollStrategies.block()
    });
    const portal = new TemplatePortal(this.pluginSaveModal, this.vcr);
    this.pluginOverlayRef.attach(portal);
    this.pluginOverlayRef.backdropClick().subscribe(() => this.cancelPluginSave());
    this.cdr.detectChanges();
  }
  closePluginSaveModal() { this.pluginOverlayRef?.dispose(); }
  confirmSavePlugin(name?: string) { const layerName = name?.trim() || this.pluginLayerName; const newLayer = this.mapFacade.saveActivePlugin(layerName); if (newLayer) this.dragOrder.unshift(newLayer); this.closePluginSaveModal(); this.cdr.detectChanges(); }
  cancelPluginSave() { this.mapFacade.cancelActivePlugin(); this.closePluginSaveModal(); this.cdr.detectChanges(); }

  get sidebarLayers(): LayerConfig[] {
    if (!this.dragOrder.length) this.dragOrder = this.layerManager.layers.filter(l => !l.isBasemap);
    return this.dragOrder;
  }

  closeSidebar(): void { }
}