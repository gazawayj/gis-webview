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
  // View child for the AI feature find modal text area for Focus
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
  private previousHoverFeature: any = null;

  public mapFacade = inject(MapFacadeService);
  private layerManager = inject(LayerManagerService);
  public toolService = inject(ToolService);
  modalFactory = inject(ModalFactoryService);
  private http = inject(HttpClient);
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

  getTooltipRowStyle(key: string): Record<string, string> { return { 'background-color': '#f0f0f0', 'padding': '2px 4px' }; }

  /**
   * Initializes map, subscribes to pointer, hover, and click events,
   * sets up layer drag order and loading observables.
   */
  ngAfterViewInit(): void {
    this.currentPlanet = this.mapFacade.getCurrentPlanet();
    this.mapFacade.initMap(this.mapContainer.nativeElement);

    // Right-click / plugin context menu
    this.mapFacade.registerContextMenuHandler(() => {
      if (this.mapFacade.getActivePlugin()) {
        this.openPluginSaveModal();
      }
    });

    // Pointer updates (lat, lon, zoom)
    this.mapFacade.pointerState$.subscribe(state => {
      this.currentLon = state.lon;
      this.currentLat = state.lat;
      this.zoomDisplay = state.zoom.toFixed(2);
      this.updateLabels();
      this.cdr.detectChanges();
    });

    // --- HOVER SUBSCRIPTION ---
    this.mapFacade.hoverFeature$.subscribe(feature => {
      // Only update hover panel if no feature is locked
      if (this.selectedFeature) return;

      // Reset previous hover
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

    // --- CLICK SUBSCRIPTION ---
    this.mapFacade.mapSingleClick$.subscribe((evt) => {
      const feature = this.mapFacade.getFeatureAtPixel(evt.pixel as [number, number]);

      if (feature) {
        this.selectedFeature = feature;
        this.hoverAttributes = this.formatFeatureAttributes(feature);
        this.layerManager.applyHoverStyle(feature as Feature);
        this.previousHoverFeature = feature;
      } else {
        // Reset selection
        if (this.selectedFeature)
          this.layerManager.resetFeatureStyle(this.selectedFeature as Feature);
        this.selectedFeature = null;
        this.hoverAttributes = null;

        // Reset hover
        if (this.previousHoverFeature) {
          this.layerManager.resetFeatureStyle(this.previousHoverFeature as Feature);
          this.previousHoverFeature = null;
        }
      }

      this.cdr.detectChanges();
    });

    // --- LAYER DRAG & DROPS ---
    this.layerManager.layers$.subscribe(layers => {
      this.dragOrder = [...layers];
      this.cdr.detectChanges();
    });

    // --- LOADING STATES ---
    this.layerManager.loading$.subscribe(v => {
      this.isLoading = v;
      this.cdr.detectChanges();
    });

    this.layerManager.loadingMessage$.subscribe(msg => {
      this.loadingMessage = msg || 'Loading...';
      this.cdr.detectChanges();
    });
  }

  /**
   * Activates a tool, creating plugin and opening any required modals.
   * @param tool ToolType string
   */
  activateTool(tool: ToolType): void {

    this.toolService.setActiveTool(tool);

    const plugin = this.toolService.createPlugin(tool, this.layerManager, this.http);
    if (!plugin) return;

    this.mapFacade.activateTool(plugin);

    // Tools that require modals
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
   * Changes planet, updates map and labels.
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

  /**
   * Updates latitude and longitude labels according to current planet.
   */
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
   * Extracts displayable attributes from a feature for hover panel.
   * @param feature FeatureLike
   * @returns Array of key/value objects or null
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
   * Updates drag order after layer is reordered via CDK drag-drop.
   * @param event CdkDragDrop event
   */
  onLayerDropped(event: CdkDragDrop<LayerConfig[]>): void {
    const newOrder = [...this.dragOrder];
    moveItemInArray(newOrder, event.previousIndex, event.currentIndex);
    this.dragOrder = newOrder;
    this.layerManager.reorderLayers(newOrder);
    this.cdr.detectChanges();
  }

  /**
  * Opens the Add Layer modal.
  */
  onAddLayer(): void {
    this.importExportModalRef = this.modalFactory.open({
      template: this.importExportModal,
      vcr: this.vcr,
      panelClass: 'layer-modal',
      width: '480px'
    });
  }

  /**
   * Toggles visibility of a layer.
   * @param layer LayerConfig
   */
  toggleLayer(layer: LayerConfig): void { this.layerManager.toggle(layer); }

  /**
   * Removes a layer.
   * @param layer LayerConfig
   */
  removeLayer(layer: LayerConfig): void { this.layerManager.remove(layer); }

  /**
   * Updates layer color and refreshes style.
   * @param layer LayerConfig
   * @param color New color
   */
  onColorPicked(layer: LayerConfig, color: string): void {
    layer.color = color;
    this.layerManager.updateStyle(layer);
  }

  /**
  * Updates layer shape and refreshes style.
  * @param layer LayerConfig
  * @param shape ShapeType
  */
  selectShape(layer: LayerConfig, shape: ShapeType): void {
    layer.shape = shape;
    this.layerManager.styleService.setLayerShape(layer.id, shape);
    this.layerManager.updateStyle(layer);
  }

  /**
   * Confirms import of selected file and adds as layer.
   */
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

  /**
   * Handles file selection and prepares CSV headers or direct GeoJSON import.
   * @param event File input change event
   */
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
        // Open modal for CSV column selection
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
        // GeoJSON: no column selection needed, import immediately
        this.importFileType = 'GeoJSON';
        this.csvHeaders = [];
        this.csvLatField = '';
        this.csvLonField = '';
        // Directly confirm import and add layer
        this.confirmImport();
      }
    };
    reader.readAsText(file);
  }

  /**
   * Opens CSV column selection modal.
   */
  openCsvSelectionModal(): void {
    if (!this.importFile || !this.csvHeaders.length) return;
    this.csvSelectionModalRef = this.modalFactory.open({
      template: this.csvSelectionModal,
      vcr: this.vcr,
      panelClass: 'layer-modal',
      width: '400px'
    });
  }

  /**
   * Cancels CSV selection and resets import state.
   */
  cancelCsvSelection() {
    if (this.csvSelectionModalRef) this.modalFactory.close(this.csvSelectionModalRef);
    this.importFile = undefined;
    this.csvHeaders = [];
    this.csvLatField = '';
    this.csvLonField = '';
  }

  /**
   * Confirms CSV column selection and creates layer.
   */
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

  /**
   * Detects likely latitude and longitude columns from CSV headers.
   * @param headers Array of CSV header strings
   * @returns Object with lat and lon keys
   */
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

  /**
   * Exports the selected layer to GeoJSON or CSV.
   */
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

  /**
   * Opens save modal for the active plugin.
   */
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

  /**
   * Confirms plugin save and clears tool.
   * @param name Optional layer name override
   */
  confirmSavePlugin(name?: string): void {
    const layerName = name?.trim() || this.pluginLayerName;
    const layer = this.mapFacade.saveByActivePlugin(layerName);
    if (layer) this.layerManager.styleService.setLayerShape(layer.id, layer.shape);
    this.toolService.clearTool();
    if (this.pluginModalRef) this.modalFactory.close(this.pluginModalRef);
  }

  /**
   * Cancels plugin save and clears tool.
   */
  cancelPluginSave(): void {
    if (this.pluginModalRef) this.modalFactory.close(this.pluginModalRef);
    this.mapFacade.cancelActivePlugin();
    this.toolService.clearTool();
  }

  /**
   * Opens AI Feature Find modal.
   */
  openAiFeatureFindModal(): void {
    this.aiPrompt = '';
    this.aiModalRef = this.modalFactory.open({
      template: this.aiFeatureFindModal,
      vcr: this.vcr,
      panelClass: 'layer-modal',
      width: '420px'
    });

    // Run after change detection so template is in DOM
    Promise.resolve().then(() => this.aiPromptTextarea?.nativeElement.focus());
  }

  /**
   * Handles keydown events in AI prompt textarea.
   * @param event KeyboardEvent
   */
  handleAiKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (this.aiPrompt.trim()) this.confirmAiFeatureFind();
    }
  }

  /**
   * Cancels AI feature find modal and clears tool.
   */
  cancelAiFeatureFind(): void {
    if (this.aiModalRef) this.modalFactory.close(this.aiModalRef);
    this.mapFacade.cancelActivePlugin();
    this.toolService.clearTool();
  }

  /**
   * Executes AI feature find via plugin.
   */
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

  /**
  * Updates selected layers and computes distance when changed.
  */
  onDistanceLayerChange(): void {
    const plugin = this.mapFacade.getActivePlugin() as LayerDistanceToolPlugin;
    if (!plugin) return;
    plugin.selectedLayers = [this.distanceLayerA || null, this.distanceLayerB || null];
    this.distanceValue = (this.distanceLayerA && this.distanceLayerB) ? plugin.computeDistance(this.distanceLayerA, this.distanceLayerB) : 0;
    this.cdr.detectChanges();
  }

  /**
   * Confirms distance measurement via plugin.
   */
  confirmLayerDistance(): void {
    const plugin = this.mapFacade.getActivePlugin() as LayerDistanceToolPlugin;
    plugin?.confirm();
  }

  /**
   * Cancels distance measurement and clears selection.
   */
  cancelLayerDistance(): void {
    const plugin = this.mapFacade.getActivePlugin() as LayerDistanceToolPlugin;
    if (plugin?.modalRef) this.modalFactory.close(plugin.modalRef);
    this.distanceLayerA = undefined;
    this.distanceLayerB = undefined;
    this.distanceValue = 0;
    this.toolService.clearTool();
  }

  /**
   * Checks if a tool is available for the current planet.
   * @param toolType Tool type string
   * @returns Boolean
   */
  isToolAvailable(toolType: string): boolean {
    if (toolType === 'highres-selection') return this.currentPlanet === 'mars';
    return true;
  }

  /**
   * Returns tooltip text for a tool.
   * @param tool Tool object
   * @returns Tooltip string
   */
  getToolTooltip(tool: any): string {
    if (!this.isToolAvailable(tool.type)) {
      const planet = this.currentPlanet.charAt(0).toUpperCase() + this.currentPlanet.slice(1);
      return `Not available on ${planet}`;
    }
    return tool.name;
  }

  /**
   * TrackBy function for ngFor layers.
   */
  trackLayer(index: number, layer: LayerConfig): string { return layer.id; }

  /**
  * TrackBy function for ngFor tools.
  */
  trackByTool(index: number, tool: ToolDefinition): string { return tool.type; }

  /**
   * Computes approximate perimeter of a Polygon or MultiPolygon.
   * @param geom Polygon or MultiPolygon
   * @returns Perimeter in meters
   */
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
}