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

  // Prevent duplicate emissions
  setActiveTool(tool: ToolType) {
    if (this.activeToolSubject.value === tool) return;
    this.activeToolSubject.next(tool);
  }

  clearTool() {
    if (this.activeToolSubject.value === 'none') return;
    this.activeToolSubject.next('none');
  }

  // Plugin creation
  createPlugin(
    tool: ToolType,
    layerManager: LayerManagerService
  ) {
    return this.tools.find(t => t.type === tool)
      ?.pluginFactory?.(layerManager);
  }

  tools: ToolDefinition[] = [
    {
      name: 'Coordinate',
      type: 'coordinate',
      icon: 'assets/icons/coordinate-tool.svg',
      pluginFactory: (lm) => new CoordinateCapturePlugin(lm)
    },
    {
      name: 'Distance',
      type: 'distance',
      icon: 'assets/icons/distance-tool.svg',
      pluginFactory: (lm) => new DistanceToolPlugin(lm)
    },
    {
      name: 'Area',
      type: 'area',
      icon: 'assets/icons/area-tool.svg',
      pluginFactory: (lm) => new AreaToolPlugin(lm)
    },
    {
      name: 'AI Feature Find',
      type: 'ai-analysis',
      icon: 'assets/icons/ai-featureFind-tool.svg',
      pluginFactory: (lm) => new AIAnalysisPlugin(lm)
    }
  ];

  get regularTools(): ToolDefinition[] {
    return this.tools.filter(t => !t.type.startsWith('ai-'));
  }

  get aiTools(): ToolDefinition[] {
    return this.tools.filter(t => t.type.startsWith('ai-'));
  }
}
