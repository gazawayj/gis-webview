import Feature, { FeatureLike } from 'ol/Feature';
import { Layer } from 'ol/layer';
import { Style } from 'ol/style';
import { ShapeType } from '../constants/symbol-constants';

export type GeometryType = 'point' | 'line' | 'polygon';

export interface LayerConfig {
  id: string;
  name: string;

  // Rendering type
  geometryType?: 'point' | 'line' | 'polygon';
  color: string;
  shape: ShapeType;
  visible: boolean;
  olLayer: Layer<any>;
  features?: Feature[];

  planet: 'earth' | 'moon' | 'mars';

  isTemporary?: boolean;
  isBasemap?: boolean;

  styleFn?: (f: FeatureLike) => Style | Style[];
}