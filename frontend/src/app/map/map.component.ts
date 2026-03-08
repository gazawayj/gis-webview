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
import Feature, { FeatureLike } from 'ol/Feature';
import { Polygon, MultiPolygon } from 'ol/geom';

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

  aiPrompt = '';
  hoverAttributes: Record<string, any> | null = null;

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
  private modalFactory = inject(ModalFactoryService);
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

  ngAfterViewInit(): void {
    this.currentPlanet = this.mapFacade.getCurrentPlanet();
    this.mapFacade.initMap(this.mapContainer.nativeElement);

    this.mapFacade.registerContextMenuHandler(() => {
      if (this.mapFacade.getActivePlugin()) {
        this.openPluginSaveModal();
      }
    });

    // ---------------- Pointer updates ----------------
    this.mapFacade.pointerState$.subscribe(state => {
      this.currentLon = state.lon;
      this.currentLat = state.lat;
      this.zoomDisplay = state.zoom.toFixed(2);
      this.updateLabels();
      this.cdr.detectChanges();
    });

    // ---------------- Hover updates ----------------
    this.mapFacade.hoverFeature$.subscribe(feature => {
      if (this.previousHoverFeature && this.previousHoverFeature !== feature) {
        this.layerManager.resetFeatureStyle(this.previousHoverFeature);
        this.previousHoverFeature = null;
      }

      if (!feature) {
        this.hoverAttributes = null;
        this.cdr.detectChanges();
        return;
      }

      this.hoverAttributes = this.formatFeatureAttributes(feature);
      this.layerManager.applyHoverStyle(feature);
      this.previousHoverFeature = feature;
      this.cdr.detectChanges();
    });

    // ---------------- Layers subscription ----------------
    this.layerManager.layers$.subscribe(layers => {
      this.dragOrder = [...layers];
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
  }

  // ---------------- Tool activation ----------------
  activateTool(tool: ToolType): void {
    this.toolService.setActiveTool(tool);
    const plugin = this.toolService.createPlugin(tool, this.layerManager, this.http);
    if (!plugin) return;
    this.mapFacade.activateTool(plugin);
  }

  setPlanet(planet: 'earth' | 'moon' | 'mars'): void {
    if (planet === this.currentPlanet) return;
    this.currentPlanet = planet;
    this.mapFacade.setPlanet(planet);
    this.toolService.clearTool();
    this.updateLabels();
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

  // ---------------- Feature hover formatting ----------------
  private formatFeatureAttributes(feature: FeatureLike): Record<string, any> | null {
    const props = feature.getProperties();
    const layer = this.layerManager.getLayerForFeature(feature as Feature);
    const isSubdivision = layer?.name?.toLowerCase().includes('subdivision');

    const cleaned: Record<string, any> = {};

    const addIfValid = (label: string, value: any) => {
      if (value !== null && value !== undefined && value !== '') {
        if (typeof value === 'number') {
          cleaned[label] = value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        } else {
          cleaned[label] = value;
        }
      }
    };

    const geom = feature.getGeometry();

    // ---------------- Subdivision-specific formatting ----------------
    if (isSubdivision) {
      addIfValid('Name', props['SUBNAME'] || props['NAME']);
      addIfValid('Subdivision Code', props['SUBCD'] || props['SUBCODE']);
      if (geom && (geom instanceof Polygon || geom instanceof MultiPolygon)) {
        const areaMeters = geom.getArea();
        const perimeterMeters = this.computePerimeter(geom);

        if (areaMeters > 0) {
          cleaned['Area'] = areaMeters >= 1000
            ? `${(areaMeters / 1000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km²`
            : `${areaMeters.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;
        }

        if (perimeterMeters > 0) {
          cleaned['Perimeter'] = perimeterMeters >= 1000
            ? `${(perimeterMeters / 1000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km`
            : `${perimeterMeters.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;
        }
      }
      return Object.keys(cleaned).length ? cleaned : null;
    }

    // ---------------- General feature formatting ----------------
    const internalKeys = [
      'geometry', 'layerId', 'tooltipData', 'featureType', 'hoverColor', 'parentPolygon',
      'AREA', 'PERIMETER', 'SHAPE_Area', 'SHAPE_Length', 'SHAPE_AREA', 'SHAPE_PERIMETER', 'OBJECTID'
    ];

    Object.keys(props).forEach(key => {
      // Skip if it's a system key or one of the raw Area/Perimeter keys from the file
      if (internalKeys.includes(key) || internalKeys.includes(key.toUpperCase())) return;

      const cleanKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      addIfValid(cleanKey, props[key]);
    });

    if (geom && (geom instanceof Polygon || geom instanceof MultiPolygon)) {
      // Determine radius based on planet for accurate Mars/Moon measurements
      const radius = this.currentPlanet === 'mars' ? 3389500 : this.currentPlanet === 'moon' ? 1737100 : 6371000;

      // Using ol/sphere helpers if available, otherwise geom methods
      const areaMeters = getArea ? getArea(geom, { radius }) : (geom as any).getArea();
      const perimeterMeters = getLength ? getLength(geom, { radius }) : this.computePerimeter(geom as any);
      if (areaMeters > 0) {
        cleaned['Area'] = areaMeters >= 1_000_000
          ? `${(areaMeters / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km²`
          : `${areaMeters.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;
      }
      if (perimeterMeters > 0) {
        cleaned['Perimeter'] = perimeterMeters >= 1000
          ? `${(perimeterMeters / 1000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km`
          : `${perimeterMeters.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;
      }
    }
    return Object.keys(cleaned).length ? cleaned : null;
  }

  // ---------------- Drag/drop layers ----------------
  onLayerDropped(event: CdkDragDrop<LayerConfig[]>): void {
    const newOrder = [...this.dragOrder];
    moveItemInArray(newOrder, event.previousIndex, event.currentIndex);
    this.dragOrder = newOrder;
    this.layerManager.reorderLayers(newOrder);
    this.cdr.detectChanges();
  }

  // ---------------- Layer management ----------------
  onAddLayer(): void {
    this.modalRef = this.modalFactory.open({
      template: this.addLayerModal,
      vcr: this.vcr
    });
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

  // ---------------- Plugin modals ----------------
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

  cancelPluginSave(): void {
    if (this.pluginModalRef) this.modalFactory.close(this.pluginModalRef);
    this.mapFacade.cancelActivePlugin();
    this.toolService.clearTool();
  }

  confirmSavePlugin(name?: string): void {
    const layerName = name?.trim() || this.pluginLayerName;
    const layer = this.mapFacade.saveByActivePlugin(layerName);
    if (layer) this.layerManager.styleService.setLayerShape(layer.id, layer.shape);
    this.toolService.clearTool();
    if (this.pluginModalRef) this.modalFactory.close(this.pluginModalRef);
  }

  // ---------------- AI modal ----------------
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

  // ---------------- Distance tool ----------------
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

  confirmLayerDistance(): void {
    const plugin = this.mapFacade.getActivePlugin() as LayerDistanceToolPlugin;
    plugin?.confirm();
  }

  cancelLayerDistance(): void {
    const plugin = this.mapFacade.getActivePlugin() as LayerDistanceToolPlugin;
    if (plugin?.modalRef) this.modalFactory.close(plugin.modalRef);

    this.distanceLayerA = undefined;
    this.distanceLayerB = undefined;
    this.distanceValue = 0;
    this.toolService.clearTool();
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

  trackLayer(index: number, layer: LayerConfig): string {
    return layer.id;
  }

  trackByTool(index: number, tool: ToolDefinition): string {
    return tool.type;
  }

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
      return geom.getLinearRings()
        .map(ring => getRingLength(ring.getCoordinates()))
        .reduce((acc, len) => acc + len, 0);
    } else {
      return geom.getPolygons()
        .map(polygon => polygon.getLinearRings()
          .map(ring => getRingLength(ring.getCoordinates()))
          .reduce((acc, len) => acc + len, 0)
        )
        .reduce((acc, len) => acc + len, 0);
    }
  }
}