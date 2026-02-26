import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ToolType, ToolDefinition } from '../models/tool-definition.model';
import { LayerManagerService } from './layer-manager.service';
import { CoordinateCapturePlugin } from '../tools/coordinate-capture.plugin';
import { DistanceToolPlugin } from '../tools/distance-tool.plugin';
import { AreaToolPlugin } from '../tools/area-tool.plugin';
import { AIAnalysisPlugin } from '../tools/ai-analysis.plugin';

@Injectable({ providedIn: 'root' })
export class ToolService {
  private activeToolSubject = new BehaviorSubject<ToolType>('none');
  activeTool$ = this.activeToolSubject.asObservable();

  setActiveTool(tool: ToolType) {
    this.activeToolSubject.next(tool);
  }

  clearTool() {
    this.activeToolSubject.next('none');
  }

  /**
   * Single source of truth for all tools.
   * Each tool can optionally provide a pluginFactory that knows
   * how to create a plugin instance for this tool.
   */
  tools: ToolDefinition[] = [
    {
      name: 'Coordinate',
      type: 'coordinate',
      icon: 'assets/icons/coordinate-tool.svg',
      pluginFactory: (lm: LayerManagerService) => new CoordinateCapturePlugin(lm)
    },
    {
      name: 'Distance',
      type: 'distance',
      icon: 'assets/icons/distance-tool.svg',
      pluginFactory: (lm: LayerManagerService) => new DistanceToolPlugin(lm)
    },
    {
      name: 'Area',
      type: 'area',
      icon: 'assets/icons/area-tool.svg',
      pluginFactory: (lm: LayerManagerService) => new AreaToolPlugin(lm)
    },
    {
      name: 'AI Feature Find',
      type: 'ai-analysis',
      icon: 'assets/icons/ai-featureFind-tool.svg',
      pluginFactory: (lm: LayerManagerService) => new AIAnalysisPlugin(lm)
    }
  ];

  /** Returns all tools except AI tools */
  get regularTools(): ToolDefinition[] {
    return this.tools.filter(t => !t.type.startsWith('ai-'));
  }

  /** Returns only AI tools */
  get aiTools(): ToolDefinition[] {
    return this.tools.filter(t => t.type.startsWith('ai-'));
  }
}