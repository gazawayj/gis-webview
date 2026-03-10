import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  TemplateRef,
  ViewContainerRef,
  inject
} from '@angular/core';
import { getArea, getLength } from 'ol/sphere';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { OverlayRef } from '@angular/cdk/overlay';
import GeoJSON from 'ol/format/GeoJSON';
import { saveAs } from 'file-saver';

import { LayerItemComponent } from './layer-item.component';
import { MapFacadeService } from './services/map-facade.service';
import { LayerManagerService } from './services/layer-manager.service';
import { ToolService } from './services/tool.service';

import { ToolType, ToolDefinition } from './models/tool-definition.model';
import { ShapeType } from './constants/symbol-constants';
import { ModalFactoryService } from './factories/modal.factory';
import { LayerConfig } from './models/layer-config.model';
import { formatAreaPerimeter } from './utils/map-utils';

import { AIAnalysisPlugin } from './tools/ai-analysis.plugin';
import { LayerDistanceToolPlugin } from './tools/layer-distance-tool.plugin';

import { HttpClient } from '@angular/common/http';
import Feature, { FeatureLike } from 'ol/Feature';
import { Polygon, MultiPolygon } from 'ol/geom';
import Papa from 'papaparse';

/**
 * Main map component responsible for rendering the OpenLayers map,
 * managing UI interaction, tools, layers, plugins, import/export,
 * hover/selection state, and per-layer context menu.
 */
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
  @ViewChild('aiFeatureFindModal') aiFeatureFindModal!: TemplateRef<any>;
  @ViewChild('layerDistanceModal') distanceModalTemplate!: TemplateRef<any>;
  @ViewChild('importExportModal') importExportModal!: TemplateRef<any>;
  @ViewChild('csvSelectionModal') csvSelectionModal!: TemplateRef<any>;
  @ViewChild('layerContextMenu') layerContextMenu!: TemplateRef<any>;
  @ViewChild('aiPromptTextarea', { static: false }) aiPromptTextarea!: ElementRef<HTMLTextAreaElement>;

  aiPrompt = '';
  importFile?: File;
  importFileType: 'CSV' | 'GeoJSON' | null = null;
  csvHeaders: string[] = [];
  csvLatField = '';
  csvLonField = '';
  csvSelectionModalRef?: OverlayRef;
  importExportModalRef?: OverlayRef;

  exportLayer?: LayerConfig;
  exportFormat: 'CSV' | 'GeoJSON' = 'GeoJSON';

  hoverAttributes: { key: string, value: any }[] | null = null;
  selectedFeature: FeatureLike | null = null;

  currentPlanet: 'earth' | 'moon' | 'mars' = 'mars';
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
  private previousHoverFeature: FeatureLike | null = null;

  private layerContextMenuRef?: OverlayRef;
  contextMenuLayer?: LayerConfig;

  public mapFacade = inject(MapFacadeService);
  private layerManager = inject(LayerManagerService);
  public toolService = inject(ToolService);
  modalFactory = inject(ModalFactoryService);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private vcr = inject(ViewContainerRef);

  // --- TOOL GETTERS ---

  /** Returns all regular tools */
  get regularTools(): ToolDefinition[] { return this.toolService.regularTools; }

  /** Returns all AI tools */
  get aiTools(): ToolDefinition[] { return this.toolService.aiTools; }

  /** Formatted longitude for display */
  get formattedLon(): string {
    const abs = Math.abs(this.currentLon).toFixed(4);
    return `${abs}° ${this.currentLon >= 0 ? 'E' : 'W'}`;
  }

  /** Formatted latitude for display */
  get formattedLat(): string {
    const abs = Math.abs(this.currentLat).toFixed(4);
    return `${abs}° ${this.currentLat >= 0 ? 'N' : 'S'}`;
  }

  /** Formatted distance for display */
  get formattedDistance(): string {
    if (this.distanceValue < 1000) return `${this.distanceValue.toFixed(2)} m`;
    return `${(this.distanceValue / 1000).toFixed(2)} km`;
  }

  /**
   * Initialize map, pointer, hover, click, drag order subscriptions
   */
  ngAfterViewInit(): void {
    this.currentPlanet = this.mapFacade.getCurrentPlanet();
    this.mapFacade.initMap(this.mapContainer.nativeElement);

    this.mapFacade.registerContextMenuHandler(() => {
      if (this.mapFacade.getActivePlugin()) {
        this.openPluginSaveModal();
      }
    });

    this.mapFacade.pointerState$.subscribe(state => {
      this.currentLon = state.lon;
      this.currentLat = state.lat;
      this.zoomDisplay = state.zoom.toFixed(2);
      this.updateLabels();
      this.cdr.detectChanges();
    });

    // Hover logic
    this.mapFacade.hoverFeature$.subscribe(feature => {
      if (this.selectedFeature) return;
      if (this.previousHoverFeature && this.previousHoverFeature !== feature) {
        this.layerManager.resetFeatureStyle(this.previousHoverFeature as Feature);
        this.previousHoverFeature = null;
      }
      if (!feature) {
        this.hoverAttributes = null;
        this.cdr.detectChanges();
        return;
      }
      this.hoverAttributes = this.formatFeatureAttributes(feature);
      this.layerManager.applyHoverStyle(feature as Feature);
      this.previousHoverFeature = feature;
      this.cdr.detectChanges();
    });

    // Click logic
    this.mapFacade.mapSingleClick$.subscribe((evt) => {
      const feature = this.mapFacade.getFeatureAtPixel(evt.pixel as [number, number]);
      if (feature) {
        this.selectedFeature = feature;
        this.hoverAttributes = this.formatFeatureAttributes(feature);
        this.layerManager.applyHoverStyle(feature as Feature);
        this.previousHoverFeature = feature;
      } else {
        if (this.selectedFeature) this.layerManager.resetFeatureStyle(this.selectedFeature as Feature);
        this.selectedFeature = null;
        this.hoverAttributes = null;
        if (this.previousHoverFeature) {
          this.layerManager.resetFeatureStyle(this.previousHoverFeature as Feature);
          this.previousHoverFeature = null;
        }
      }
      this.closeLayerContextMenu();
      this.cdr.detectChanges();
    });

    // Drag order subscription
    this.layerManager.layers$.subscribe(layers => {
      this.dragOrder = [...layers];
      this.cdr.detectChanges();
    });

    this.layerManager.loading$.subscribe(v => { this.isLoading = v; this.cdr.detectChanges(); });
    this.layerManager.loadingMessage$.subscribe(msg => { this.loadingMessage = msg || 'Loading...'; this.cdr.detectChanges(); });
    // Prevent other right clicks besides on layer item.
    document.addEventListener('contextmenu', this.preventBrowserContextMenu);
  }

  /** Prevents the default browser context menu */
  private preventBrowserContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };

  /**
   * Handles right-click on a layer in the sidebar.
   * @param event MouseEvent
   * @param layer LayerConfig
   */
  onLayerRightClick(event: MouseEvent, layer: LayerConfig): void {
    event.preventDefault();
    this.closeLayerContextMenu();

    this.contextMenuLayer = layer ?? undefined;
    const positionStrategy = this.modalFactory['overlay'].position()
      .global()
      .left(`${event.clientX}px`)
      .top(`${event.clientY}px`);

    this.layerContextMenuRef = this.modalFactory.open({
      template: this.layerContextMenu,
      vcr: this.vcr,
      panelClass: 'layer-context-menu',
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-transparent-backdrop',
      positionStrategy
    });

    this.layerContextMenuRef.backdropClick().subscribe(() => this.closeLayerContextMenu());
  }

  /** Closes the layer context menu */
  closeLayerContextMenu(): void {
    if (this.layerContextMenuRef) {
      this.modalFactory.close(this.layerContextMenuRef);
      this.layerContextMenuRef = undefined;
      this.contextMenuLayer = undefined;
    }
  }

  /**
   * Activates a tool plugin
   * @param tool ToolType
   */
  activateTool(tool: ToolType): void {
    this.toolService.setActiveTool(tool);

    const plugin = this.toolService.createPlugin(tool, this.layerManager, this.http);
    if (!plugin) return;

    this.mapFacade.activateTool(plugin);

    // Open modals for specific tools
    switch (tool) {
      case 'ai-analysis':
        this.openAiFeatureFindModal();
        break;
      case 'layer-distance': {
        const distancePlugin = this.mapFacade.getActivePlugin() as LayerDistanceToolPlugin;
        if (!distancePlugin) return;
        distancePlugin.modalRef = this.modalFactory.open({
          template: this.distanceModalTemplate,
          vcr: this.vcr,
          panelClass: 'layer-modal',
          width: '430px'
        });
        break;
      }
    }

    this.cdr.detectChanges();
  }

  /**
   * Changes the current planet
   * @param planet 'earth'|'moon'|'mars'
   */
  setPlanet(planet: 'earth' | 'moon' | 'mars'): void {
    if (planet === this.currentPlanet) return;
    this.currentPlanet = planet;
    this.mapFacade.setPlanet(planet);
    this.toolService.clearTool();
    this.updateLabels();
    this.cdr.detectChanges();
  }

  /** Updates lat/lon labels according to current planet */
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

  /**
   * Extracts displayable attributes from a feature
   * @param feature FeatureLike
   * @returns Array of key/value pairs or null
   */
  private formatFeatureAttributes(feature: FeatureLike): { key: string, value: any }[] | null {
    const props = feature.getProperties();
    const layer = this.layerManager.getLayerForFeature(feature as Feature);
    const isSubdivision = layer?.name?.toLowerCase().includes('subdivision') || layer?.name?.toLowerCase().includes('ice');

    const cleaned: { key: string, value: any }[] = [];
    const addIfValid = (label: string, value: any) => {
      if (value !== null && value !== undefined && value !== '') {
        const formatted = typeof value === 'number'
          ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : value;
        cleaned.push({ key: label, value: formatted });
      }
    };

    const geom = feature.getGeometry();
    const radius = this.currentPlanet === 'mars' ? 3389500 : this.currentPlanet === 'moon' ? 1737100 : 6371000;
    addIfValid('Name', props['SUBNAME'] || props['NAME'] || props['UNIT_NAME']);
    addIfValid('Code', props['SUBCD'] || props['SUBCODE'] || props['SUBDIVISION_CODE'] || props['id']);

    if (!isSubdivision) {
      const internalKeys = ['geometry', 'layerId', 'tooltipData', 'featureType', 'hoverColor', 'id'];
      Object.keys(props).forEach(key => {
        if (internalKeys.includes(key) || cleaned.some(c => c.key === key)) return;
        addIfValid(key.replace(/_/g, ' '), props[key]);
      });
    }

    if (geom && (geom instanceof Polygon || geom instanceof MultiPolygon)) {
      const areaMeters = getArea ? getArea(geom, { radius }) : (geom as any).getArea();
      const perimeterMeters = getLength ? getLength(geom, { radius }) : this.computePerimeter(geom as any);
      const formatted = formatAreaPerimeter(areaMeters, perimeterMeters);
      if (formatted.area) cleaned.push({ key: 'Area', value: formatted.area });
      if (formatted.perimeter) cleaned.push({ key: 'Perimeter', value: formatted.perimeter });
    }

    return cleaned.length ? cleaned : null;
  }

  /**
   * Updates drag order after layer reordering
   * @param event CdkDragDrop event
   */
  onLayerDropped(event: CdkDragDrop<LayerConfig[]>): void {
    const newOrder = [...this.dragOrder];
    moveItemInArray(newOrder, event.previousIndex, event.currentIndex);
    this.dragOrder = newOrder;
    this.layerManager.reorderLayers(newOrder);
    this.cdr.detectChanges();
  }

  /** Opens the Add Layer modal */
  onAddLayer(): void {
    this.importExportModalRef = this.modalFactory.open({
      template: this.importExportModal,
      vcr: this.vcr,
      panelClass: 'layer-modal',
      width: '480px'
    });
  }

  /** Toggles layer visibility */
  toggleLayer(layer?: LayerConfig): void {
    if (!layer) return;
    this.layerManager.toggle(layer);
    this.closeLayerContextMenu();
  }

  /** Removes a layer */
  removeLayer(layer?: LayerConfig): void {
    if (!layer) return;
    this.layerManager.remove(layer);
    this.closeLayerContextMenu();
  }

  /** Updates layer color */
  onColorPicked(layer: LayerConfig, color: string): void {
    layer.color = color;
    this.layerManager.updateStyle(layer);
  }

  /** Updates layer shape */
  selectShape(layer: LayerConfig, shape: ShapeType): void {
    layer.shape = shape;
    this.layerManager.styleService.setLayerShape(layer.id, shape);
    this.layerManager.updateStyle(layer);
  }

  /** Confirms import of file */
  confirmImport(): void {
    if (!this.importFile || !this.importFileType) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      const layerName = this.importFile!.name.replace(/\.[^/.]+$/, '');
      if (this.importFileType === 'CSV') {
        this.layerManager.addManualLayer(
          this.currentPlanet,
          layerName,
          'Imported layer',
          content,
          'CSV',
          this.csvLatField,
          this.csvLonField
        );
      } else if (this.importFileType === 'GeoJSON') {
        this.layerManager.addManualLayer(
          this.currentPlanet,
          layerName,
          'Imported layer',
          content,
          'GeoJSON'
        );
      }
      if (this.importExportModalRef) this.modalFactory.close(this.importExportModalRef);
      this.importFile = undefined;
      this.csvHeaders = [];
      this.csvLatField = '';
      this.csvLonField = '';
    };
    reader.readAsText(this.importFile);
  }

  /** Handles file selection */
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) return;
    this.importFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      if (file.name.toLowerCase().endsWith('.csv')) {
        this.importFileType = 'CSV';
        const parsed = Papa.parse(content, { header: true, preview: 1 });
        this.csvHeaders = parsed.meta.fields || [];
        const { lat, lon } = this.detectLatLonColumns(this.csvHeaders);
        this.csvLatField = lat || this.csvHeaders[0] || '';
        this.csvLonField = lon || this.csvHeaders[1] || '';
        Promise.resolve().then(() => {
          if (this.importExportModalRef) this.modalFactory.close(this.importExportModalRef);
          this.importExportModalRef = this.modalFactory.open({
            template: this.importExportModal,
            vcr: this.vcr,
            panelClass: 'layer-modal',
            width: '480px'
          });
          this.cdr.detectChanges();
        });
      } else {
        this.importFileType = 'GeoJSON';
        this.csvHeaders = [];
        this.csvLatField = '';
        this.csvLonField = '';
        this.confirmImport();
      }
    };
    reader.readAsText(file);
  }

  /** Opens CSV selection modal */
  openCsvSelectionModal(): void {
    if (!this.importFile || !this.csvHeaders.length) return;
    this.csvSelectionModalRef = this.modalFactory.open({
      template: this.csvSelectionModal,
      vcr: this.vcr,
      panelClass: 'layer-modal',
      width: '400px'
    });
  }

  /** Cancels CSV selection */
  cancelCsvSelection() {
    if (this.csvSelectionModalRef) this.modalFactory.close(this.csvSelectionModalRef);
    this.importFile = undefined;
    this.csvHeaders = [];
    this.csvLatField = '';
    this.csvLonField = '';
  }

  /** Confirms CSV selection and adds layer */
  confirmCsvSelection() {
    if (!this.importFile) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      const layerName = this.importFile!.name.replace(/\.[^/.]+$/, '');
      let newLayer: LayerConfig | undefined;
      if (this.importFileType === 'CSV') {
        newLayer = this.layerManager.addManualLayer(
          this.currentPlanet,
          layerName,
          'Imported layer',
          content,
          'CSV',
          this.csvLatField,
          this.csvLonField
        );
      } else if (this.importFileType === 'GeoJSON') {
        newLayer = this.layerManager.addManualLayer(
          this.currentPlanet,
          layerName,
          'Imported layer',
          content,
          'GeoJSON'
        );
      }
      if (newLayer) {
        this.dragOrder = [...this.dragOrder, newLayer];
        this.cdr.detectChanges();
      }
      if (this.csvSelectionModalRef) this.modalFactory.close(this.csvSelectionModalRef);
      if (this.importExportModalRef) this.modalFactory.close(this.importExportModalRef);
      this.importFile = undefined;
      this.csvHeaders = [];
      this.csvLatField = '';
      this.csvLonField = '';
    };
    reader.readAsText(this.importFile);
  }

  /** Detects likely latitude and longitude columns from CSV headers */
  private detectLatLonColumns(headers: string[]): { lat?: string, lon?: string } {
    const lower = headers.map(h => h.toLowerCase());
    let lat: string | undefined;
    let lon: string | undefined;
    const latNames = ['lat', 'latitude', 'y'];
    const lonNames = ['lon', 'longitude', 'lng', 'x'];
    for (let i = 0; i < lower.length; i++) {
      if (!lat && latNames.includes(lower[i])) lat = headers[i];
      if (!lon && lonNames.includes(lower[i])) lon = headers[i];
    }
    return { lat, lon };
  }

  /** Confirms export of selected layer */
  confirmExport(): void {
    if (!this.exportLayer) return;
    const features = this.exportLayer.features;
    if (!features || !features.length) return;

    if (this.exportFormat === 'GeoJSON') {
      const geojson = new GeoJSON().writeFeatures(features, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' });
      saveAs(new Blob([geojson], { type: 'application/json' }), `${this.exportLayer.name}.geojson`);
    } else if (this.exportFormat === 'CSV') {
      const allKeys = Array.from(new Set(features.flatMap(f => Object.keys(f.getProperties()))));
      const rows = [allKeys.join(',')];
      features.forEach(f => {
        const props = f.getProperties();
        const row = allKeys.map(k => {
          let val = props[k];
          if (val && typeof val === 'object') val = JSON.stringify(val);
          if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) val = `"${val.replace(/"/g, '""')}"`;
          return val ?? '';
        }).join(',');
        rows.push(row);
      });
      saveAs(new Blob([rows.join('\n')], { type: 'text/csv' }), `${this.exportLayer.name}.csv`);
    }

    if (this.importExportModalRef) this.modalFactory.close(this.importExportModalRef);
  }

  /** Opens plugin save modal */
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

  /** Confirms plugin save */
  confirmSavePlugin(name?: string): void {
    const layerName = name?.trim() || this.pluginLayerName;
    const layer = this.mapFacade.saveByActivePlugin(layerName);
    if (layer) this.layerManager.styleService.setLayerShape(layer.id, layer.shape);
    this.toolService.clearTool();
    if (this.pluginModalRef) this.modalFactory.close(this.pluginModalRef);
  }

  /** Cancels plugin save */
  cancelPluginSave(): void {
    if (this.pluginModalRef) this.modalFactory.close(this.pluginModalRef);
    this.mapFacade.cancelActivePlugin();
    this.toolService.clearTool();
  }

  /** Opens AI feature find modal */
  openAiFeatureFindModal(): void {
    this.aiPrompt = '';
    this.aiModalRef = this.modalFactory.open({
      template: this.aiFeatureFindModal,
      vcr: this.vcr,
      panelClass: 'layer-modal',
      width: '420px'
    });

    Promise.resolve().then(() => this.aiPromptTextarea?.nativeElement.focus());
  }

  /** Handles AI keydown */
  handleAiKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (this.aiPrompt.trim()) this.confirmAiFeatureFind();
    }
  }

  /** Cancels AI feature find */
  cancelAiFeatureFind(): void {
    if (this.aiModalRef) this.modalFactory.close(this.aiModalRef);
    this.mapFacade.cancelActivePlugin();
    this.toolService.clearTool();
  }

  /** Executes AI feature find */
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

  /** Computes distance for distance plugin */
  distanceLayerModalCompute(): void {
    const plugin = this.mapFacade.getActivePlugin() as LayerDistanceToolPlugin;
    if (!plugin) return;
    plugin.selectedLayers = [this.distanceLayerA || null, this.distanceLayerB || null];
    this.distanceValue = (this.distanceLayerA && this.distanceLayerB)
      ? plugin.computeDistance(this.distanceLayerA, this.distanceLayerB)
      : 0;
    this.cdr.detectChanges();
  }

  /** Confirms layer distance */
  confirmLayerDistance(): void {
    const plugin = this.mapFacade.getActivePlugin() as LayerDistanceToolPlugin;
    plugin?.confirm();
  }

  /** Cancels layer distance */
  cancelLayerDistance(): void {
    const plugin = this.mapFacade.getActivePlugin() as LayerDistanceToolPlugin;
    if (plugin?.modalRef) this.modalFactory.close(plugin.modalRef);
    this.distanceLayerA = undefined;
    this.distanceLayerB = undefined;
    this.distanceValue = 0;
    this.toolService.clearTool();
  }

  /** Checks if tool is available for planet */
  isToolAvailable(toolType: string): boolean {
    if (toolType === 'highres-selection') return this.currentPlanet === 'mars';
    return true;
  }

  /** Returns tooltip for tool */
  getToolTooltip(tool: any): string {
    if (!this.isToolAvailable(tool.type)) {
      const planet = this.currentPlanet.charAt(0).toUpperCase() + this.currentPlanet.slice(1);
      return `Not available on ${planet}`;
    }
    return tool.name;
  }

  /** TrackBy function for layers */
  trackLayer(index: number, layer: LayerConfig): string { return layer.id; }

  /** TrackBy function for tools */
  trackByTool(index: number, tool: ToolDefinition): string { return tool.type; }

  /** Computes approximate perimeter */
  private computePerimeter(geom: Polygon | MultiPolygon): number {
    const getRingLength = (coords: number[][]): number => {
      let len = 0;
      for (let i = 0; i < coords.length - 1; i++) {
        const dx = coords[i + 1][0] - coords[i][0];
        const dy = coords[i + 1][1] - coords[i][1];
        len += Math.sqrt(dx * dx + dy * dy);
      }
      return len;
    };

    if (geom instanceof Polygon) {
      return geom.getLinearRings().map(r => getRingLength(r.getCoordinates())).reduce((acc, v) => acc + v, 0);
    } else {
      return geom.getPolygons().map(p => p.getLinearRings().map(r => getRingLength(r.getCoordinates())).reduce((acc, v) => acc + v, 0)).reduce((acc, v) => acc + v, 0);
    }
  }

  /**
  * Toggles layer visibility AND updates the layer item checkbox.
  * @param layer Layer to toggle
  */
  toggleLayerWithCheckbox(layer?: LayerConfig) {
    if (!layer) return;
    // Toggle using the LayerManager's toggle()
    this.layerManager.toggle(layer);
    // Refresh sidebar so the checkbox updates
    this.layerManager.refreshLayersForPlanet(layer.planet);
  }

  /**
   * Renames a layer using a prompt and updates registry and drag order.
   * @param layer Layer to rename
   */
  renameLayer(layer?: LayerConfig) {
    if (!layer) return;
    const newName = prompt('Enter new layer name:', layer.name);
    if (!newName || !newName.trim()) return;
    const trimmed = newName.trim();
    // Resolve conflicts
    const finalName = this.layerManager['resolveLayerName'](layer.planet, trimmed);
    layer.name = finalName;
    // Since dragOrder and registry hold references, just refresh the sidebar
    this.layerManager.refreshLayersForPlanet(layer.planet);
    this.closeLayerContextMenu();
  }

  /**
   * Activates an editing tool for the given layer.
   * @param layer Layer to edit
   */
  editLayer(layer?: LayerConfig) {
    if (!layer) return;
    // Example: assume each editable layer has a plugin/tool type stored
    const toolType = (layer as any).toolType; // your implementation may vary
    if (!toolType) {
      console.warn('No tool associated with this layer.');
      return;
    }
    // Activate the tool for editing, passing the layer as context
    this.closeLayerContextMenu();
    this.activateTool(toolType);
  }

}