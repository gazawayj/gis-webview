import { Feature } from 'ol';
import { FeatureLike } from 'ol/Feature';
import { Style } from 'ol/style';
import { ShapeType } from '../constants/symbol-constants';
import { LayerConfig } from '../services/layer-manager.service';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { StyleService } from '../services/style.service';

/**
 * Factory type for creating a LayerConfig.
 * The factory can receive a planet and optional parameters like name, features, color, shape, etc.
 */
export type LayerFactory = (
  planet: 'earth' | 'moon' | 'mars',
  options?: Partial<{
    name: string;
    features: Feature[];
    color: string;
    shape: ShapeType | 'line';
    isTemporary: boolean;
    styleFn: (f: FeatureLike) => Style[];
  }>
) => LayerConfig;

/**
 * Default implementation helper for factories.
 * Creates a VectorLayer and LayerConfig using StyleService.
 */
export function createVectorLayerFactory(styleService: StyleService): LayerFactory {
  return (planet, options) => {
    const {
      name = `Layer-${Date.now()}`,
      features = [],
      color = styleService.getRandomColor(),
      shape = styleService.getRandomShape() || 'circle',
      isTemporary = false,
      styleFn
    } = options || {};

    const layerStyleFn = styleFn || ((f: FeatureLike) => {
      const type = shape === 'line' ? 'line' : 'point';
      return [styleService.getLayerStyle({ type, baseColor: color, shape })];
    });

    const vectorLayer = new VectorLayer({
      source: new VectorSource({ features: features.map(f => f.clone()) }),
      style: layerStyleFn
    });

    const layerConfig: LayerConfig = {
      id: `${name}-${Date.now()}`,
      name,
      color,
      shape,
      visible: true,
      olLayer: vectorLayer,
      isTemporary,
      _planet: planet,
      styleFn: layerStyleFn
    };

    return layerConfig;
  };
}