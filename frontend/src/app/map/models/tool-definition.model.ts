import { LayerManagerService } from "../services/layer-manager.service";
import { Tool } from "../../tools/tool";

export type ToolType =
  | 'coordinate'
  | 'distance'
  | 'area'
  | 'none'
  | 'ai-analysis';

export interface ToolDefinition {
  name: string;
  type: ToolType;
  icon?: string;

  pluginFactory?: (layerManager: LayerManagerService) => Tool;
}