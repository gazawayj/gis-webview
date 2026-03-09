import { HttpClient } from "@angular/common/http";

/** Supported tool identifiers */
export type ToolType =
  | 'coordinate'
  | 'distance'
  | 'area'
  | 'none'
  | 'ai-analysis'
  | 'highres-selection'
  | 'layer-distance';

/** Defines a tool that can be rendered in the toolbox */
export interface ToolDefinition {

  /** Display name of the tool */
  name: string;

  /** Tool identifier (matches ToolType) */
  type: ToolType;

  /** Optional HTML icon string for button, used for SVG icon */
  icon?: string;

  /**
   * Factory function to create the plugin for this tool.
   * @param layerManager LayerManagerService instance
   * @param http Optional HttpClient for API requests
   * @returns Plugin instance
   */
  pluginFactory: (layerManager: any, http?: HttpClient) => any;
}