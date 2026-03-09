import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { ToolType, ToolDefinition } from '../models/tool-definition.model';
import { LayerManagerService } from './layer-manager.service';
import { StyleService } from './style.service';
import { CoordinateCapturePlugin } from '../tools/coordinate-capture.plugin';
import { DistanceToolPlugin } from '../tools/distance-tool.plugin';
import { AreaToolPlugin } from '../tools/area-tool.plugin';
import { AIAnalysisPlugin } from '../tools/ai-analysis.plugin';
import { LayerDistanceToolPlugin } from '../tools/layer-distance-tool.plugin';
import { HighResSelectionPlugin } from '../tools/highres-selection.plugin';

/**
 * Service managing map tools and plugins.
 * Tracks the active tool and provides creation of plugin instances.
 */
@Injectable({ providedIn: 'root' })
export class ToolService {
  /** Style service for AI tools */
  private styleService = inject(StyleService);

  /** Currently active tool state as observable */
  private activeToolSubject = new BehaviorSubject<ToolType>('none');
  public readonly activeTool$ = this.activeToolSubject.asObservable();

  /**
   * Sets the active tool if different from the current one
   * @param tool - ToolType to activate
   */
  setActiveTool(tool: ToolType): void {
    if (this.activeToolSubject.value === tool) return;
    this.activeToolSubject.next(tool);
  }

  /**
   * Clears the active tool to 'none'
   */
  clearTool(): void {
    if (this.activeToolSubject.value === 'none') return;
    this.activeToolSubject.next('none');
  }

  /** Immutable registry of all tools and their plugin factories */
  private readonly toolRegistry: ToolDefinition[] = [
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
      name: 'High-Res View Tool',
      type: 'highres-selection',
      icon: 'assets/icons/highres-selection.svg',
      pluginFactory: (lm) => new HighResSelectionPlugin(lm)
    },
    {
      name: 'AI Feature Find Tool',
      type: 'ai-analysis',
      icon: 'assets/icons/ai-featureFind-tool.svg',
      pluginFactory: (lm, http?: HttpClient) => {
        if (!http) {
          throw new Error('HttpClient must be provided for AIAnalysisPlugin');
        }
        return new AIAnalysisPlugin(lm, http, this.styleService);
      }
    }
  ];

  /** Lookup map for constant-time access by ToolType */
  private readonly toolMap: Map<ToolType, ToolDefinition> =
    new Map(this.toolRegistry.map(t => [t.type, t]));

  /**
  * Creates a plugin instance for a tool.
  * @param tool - ToolType to create
  * @param layerManager - LayerManagerService instance
  * @param http - Optional HttpClient (needed for AI tools)
  */
  createPlugin(
    tool: ToolType,
    layerManager: LayerManagerService,
    http?: HttpClient
  ) {
    const toolDef = this.toolMap.get(tool);
    if (!toolDef || !toolDef.pluginFactory) return undefined;

    return toolDef.pluginFactory(layerManager, http);
  }


  /** Returns tools that are non-AI */
  get regularTools(): ToolDefinition[] {
    return this.toolRegistry.filter(t => !t.type.startsWith('ai-'));
  }


  /** Returns tools that are AI-based */
  get aiTools(): ToolDefinition[] {
    return this.toolRegistry.filter(t => t.type.startsWith('ai-'));
  }
}