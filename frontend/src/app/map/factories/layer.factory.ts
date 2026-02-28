import { Feature } from 'ol';
import { FeatureLike } from 'ol/Feature';
import { Style } from 'ol/style';
import { ShapeType } from '../constants/symbol-constants';
import { LayerConfig, GeometryType } from '../models/layer-config.model';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { StyleService } from '../services/style.service';

export type LayerFactory = (
  planet: 'earth' | 'moon' | 'mars',
  options?: Partial<{
    name: string;
    features: Feature[];
    color: string;
    shape: ShapeType | 'line';
    isTemporary: boolean;
    styleFn: (f: FeatureLike) => Style | Style[];
    geometryType: GeometryType;
  }>
) => LayerConfig;

// FACTORY
export function createVectorLayerFactory(styleService: StyleService): LayerFactory {
  return (planet, options) => {
    const {
      name = `Layer-${Date.now()}`,
      features = [],
      color = styleService.getRandomColor(),
      shape = styleService.getRandomShape() || 'circle',
      isTemporary = false,
      styleFn,
      geometryType: optGeometryType,
    } = options || {};

    // Determine geometry type
    const geometryType: GeometryType = optGeometryType
      ? optGeometryType
      : detectGeometryType(features, shape);

    let configRef: LayerConfig;

    const layerStyleFn: (f: FeatureLike) => Style | Style[] = styleFn
      ? styleFn
      : (f) => {
          const feature = f as Feature;
          const fType = feature.get('featureType') as string | undefined;

          // Label styling
          if (fType === 'label') {
            return styleService.getLayerStyle({
              type: 'label',
              baseColor: configRef.color,
              text: feature.get('text') as string | undefined,
            });
          }

          // Determine geometry styling type
          let type: GeometryType = 'point';
          if (fType === 'line' || configRef.geometryType === 'line') type = 'line';
          else if (fType === 'polygon' || configRef.geometryType === 'polygon') type = 'polygon';

          return styleService.getLayerStyle({
            type,
            baseColor: configRef.color,
            shape: configRef.shape,
          });
        };

    const vectorLayer = new VectorLayer({
      source: new VectorSource({
        features: features.map(f => f.clone())
      }),
      style: (f) => {
        const result = layerStyleFn(f);
        return Array.isArray(result) ? result : [result];
      },
    });

    const config: LayerConfig = {
      id: `${name}-${Date.now()}`,
      name,
      color,
      shape,
      visible: true,
      olLayer: vectorLayer,
      isTemporary,
      planet,
      styleFn: layerStyleFn,
      features: features.map(f => f.clone()),
      geometryType,
    };
    configRef = config;

    return config;
  };
}

//  HELPERS
function detectGeometryType(
  features: Feature[],
  shape?: ShapeType | 'line'
): GeometryType {
  if (features.length) {
    for (const f of features) {
      const geomType = f.getGeometry()?.getType();
      if (geomType === 'LineString' || geomType === 'MultiLineString') return 'line';
      if (geomType === 'Polygon' || geomType === 'MultiPolygon') return 'polygon';
    }
  }
  return shape === 'line' ? 'line' : 'point';
}
