import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ToolType, ToolDefinition } from '../models/tool-definition.model';
import { LayerManagerService } from './layer-manager.service';
import { StyleService } from './style.service';
import { CoordinateCapturePlugin } from '../../tools/coordinate-capture.plugin';
import { DistanceToolPlugin } from '../../tools/distance-tool.plugin';
import { AreaToolPlugin } from '../../tools/area-tool.plugin';
import { AIAnalysisPlugin } from '../../tools/ai-analysis.plugin';
import { HttpClient } from '@angular/common/http';
import { LayerDistanceToolPlugin } from 'src/app/tools/layer-distance-tool.plugin';

@Injectable({ providedIn: 'root' })
export class ToolService {

  // Inject StyleService properly
  private styleService = inject(StyleService);

  private activeToolSubject = new BehaviorSubject<ToolType>('none');
  activeTool$ = this.activeToolSubject.asObservable();

  setActiveTool(tool: ToolType) {
    if (this.activeToolSubject.value === tool) return;
    this.activeToolSubject.next(tool);
  }

  clearTool() {
    if (this.activeToolSubject.value === 'none') return;
    this.activeToolSubject.next('none');
  }

  // Centralized plugin creation, optional HttpClient for AI plugins
  createPlugin(
    tool: ToolType,
    layerManager: LayerManagerService,
    http?: HttpClient
  ) {
    const toolDef = this.tools.find(t => t.type === tool);
    if (!toolDef?.pluginFactory) return undefined;

    return toolDef.pluginFactory(layerManager, http);
  }

  tools: ToolDefinition[] = [
    {
      name: 'Coordinate Capture Tool',
      type: 'coordinate',
      icon: 'assets/icons/coordinate-tool.svg',
      pluginFactory: (lm) => new CoordinateCapturePlugin(lm)
    },
    {
      name: 'Distance Tool',
      type: 'distance',
      icon: 'assets/icons/distance-tool.svg',
      pluginFactory: (lm) => new DistanceToolPlugin(lm)
    },
    {
      name: 'Distance Tool - Layers',
      type: 'layer-distance',
      icon: 'assets/icons/layer-distance-tool.svg',
      pluginFactory: (lm) => new LayerDistanceToolPlugin(lm)
    },
    {
      name: 'Area Tool',
      type: 'area',
      icon: 'assets/icons/area-tool.svg',
      pluginFactory: (lm) => new AreaToolPlugin(lm)
    },
    {
      name: 'AI Feature Find Tool',
      type: 'ai-analysis',
      icon: 'assets/icons/ai-featureFind-tool.svg',
      pluginFactory: (lm, http?: HttpClient) => {
        if (!http) throw new Error('HttpClient must be provided for AIAnalysisPlugin');
        return new AIAnalysisPlugin(lm, http, this.styleService);
      }
    }
  ];

  get regularTools(): ToolDefinition[] {
    return this.tools.filter(t => !t.type.startsWith('ai-'));
  }

  get aiTools(): ToolDefinition[] {
    return this.tools.filter(t => t.type.startsWith('ai-'));
  }
}