// This defines the interface all toll plugins will implement
import type Map from 'ol/Map';
import type { FeatureLike } from 'ol/Feature';
import type { Style } from 'ol/style';

export interface ToolPlugin {
  name: string;

  /** Called when the tool is activated */
  activate(map: Map): void;

  /** Called when the tool is deactivated or cancelled */
  deactivate(): void;

  /** Optional: return features created by the tool */
  getFeatures?(): FeatureLike[];

  /** Optional: provide styles for the tool's features */
  getStyle?(feature: FeatureLike): Style[];
}