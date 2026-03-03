import { HttpClient } from "@angular/common/http";

export type ToolType =
  | 'coordinate'
  | 'distance'
  | 'area'
  | 'none'
  | 'ai-analysis'
  | 'layer-distance';

export interface ToolDefinition {
  name: string;
  type: ToolType;
  icon?: string;

  pluginFactory: (layerManager: any, http?: HttpClient) => any;
}