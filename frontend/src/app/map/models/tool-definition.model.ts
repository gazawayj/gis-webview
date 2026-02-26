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
}