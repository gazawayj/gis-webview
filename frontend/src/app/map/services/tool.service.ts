import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ToolType, ToolDefinition } from '../models/tool-definition.model';

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

  // Single source of truth: all tool definitions
  readonly tools: ToolDefinition[] = [
    { name: 'Coordinate', type: 'coordinate', icon: 'assets/icons/coordinate-tool.svg' },
    { name: 'Distance', type: 'distance', icon: 'assets/icons/distance-tool.svg' },
    { name: 'Area', type: 'area', icon: 'assets/icons/area-tool.svg' },
    { name: 'AI Feature Find', type: 'ai-analysis', icon: 'assets/icons/ai-featureFind-tool.svg' }
  ];
}