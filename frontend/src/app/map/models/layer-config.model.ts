import Feature, { FeatureLike } from 'ol/Feature';
import { Layer } from 'ol/layer';
import { Style } from 'ol/style';
import { ShapeType } from '../constants/symbol-constants';

export type GeometryType = 'point' | 'line' | 'polygon';

export interface LayerConfig {
  /** Unique layer identifier */
  id: string;

  /** Display name of the layer */
  name: string;

  /** Geometry type of features: point, line, or polygon */
  geometryType?: 'point' | 'line' | 'polygon';

  /** Layer color (used for styling features) */
  color: string;

  /** Shape used for point/vertex features */
  shape: ShapeType;

  /** Visibility toggle */
  visible: boolean;

  /** OpenLayers Layer instance (TileLayer or VectorLayer) */
  olLayer: Layer<any>;

  /** Optional array of features on this layer */
  features?: Feature[];

  /** Marks layer as a tile layer */
  isTileLayer?: boolean;

  /** Tile URL if applicable */
  tileUrl?: string;

  /** Optional tile extent for bounding */
  tileExtent?: number[];

  /** Allows drawing lines if true */
  allowLine?: boolean;

  /** Planet this layer belongs to ('earth'|'moon'|'mars') */
  planet: 'earth' | 'moon' | 'mars';

  /** Marks layer as temporary (tool layer) */
  isTemporary?: boolean;

  /** Marks layer as a basemap */
  isBasemap?: boolean;

  /** Marks layer as high-resolution */
  isHighRes?: boolean;

  /** Optional KD-Tree for spatial queries */
  kdTree?: any;

  /** Optional function to generate dynamic style for features */
  styleFn?: (f: FeatureLike) => Style | Style[];
}