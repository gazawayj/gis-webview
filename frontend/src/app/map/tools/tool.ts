import type { FeatureLike } from 'ol/Feature';
import type { Style } from 'ol/style';
import Map from 'ol/Map';
import { LayerConfig } from '../models/layer-config.model';

export interface Tool {
  name: string;

  activate(map: Map): void;
  cancel(): void;
  deactivate(): void;
  save?(name: string): LayerConfig | null;
  getFeatures?(): FeatureLike[];
  getStyle?(feature: FeatureLike): Style[];
}