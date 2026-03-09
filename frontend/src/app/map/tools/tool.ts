import type { FeatureLike } from 'ol/Feature';
import type { Style } from 'ol/style';
import Map from 'ol/Map';
import { LayerConfig } from '../models/layer-config.model';

/**
 * Interface defining a map tool/plugin.
 * Provides lifecycle methods, optional save, feature, and style access.
 */
export interface Tool {
  /** Tool display name */
  name: string;

  /** Activate tool on the given map */
  activate(map: Map): void;

  /** Cancel/abort tool operation */
  cancel(): void;

  /** Deactivate tool */
  deactivate(): void;

  /** Optional: save current tool state/features to a layer */
  save?(name: string): LayerConfig | null;

  /** Optional: return features currently created by the tool */
  getFeatures?(): FeatureLike[];

  /** Optional: return styles for a feature */
  getStyle?(feature: FeatureLike): Style[];
}