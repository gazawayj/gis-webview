import type { FeatureLike } from 'ol/Feature';
import type { Style } from 'ol/style';
import Map from 'ol/Map';

export interface Tool {
  name: string;

  activate(map: Map): void;
  cancel(): void;
  deactivate(): void;
  save?(name: string): void;
  getFeatures?(): FeatureLike[];
  getStyle?(feature: FeatureLike): Style[];
}