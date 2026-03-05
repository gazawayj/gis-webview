import { HttpClient } from "@angular/common/http";

export type ToolType =
  | 'coordinate'
  | 'distance'
  | 'area'
  | 'none'
  | 'ai-analysis'
  | 'highres-selection'
  | 'layer-distance';

export interface ToolDefinition {
  name: string;
  type: ToolType;
  icon?: string;

  pluginFactory: (layerManager: any, http?: HttpClient) => any;
}