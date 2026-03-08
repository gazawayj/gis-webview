import { Feature } from 'ol';
import { FeatureLike } from 'ol/Feature';
import { Style } from 'ol/style';
import { ShapeType } from '../constants/symbol-constants';
import { LayerConfig, GeometryType } from '../models/layer-config.model';
import VectorLayer from 'ol/layer/Vector';
import VectorImageLayer from 'ol/layer/VectorImage';
import VectorSource from 'ol/source/Vector';
import { StyleService } from '../services/style.service';

export type LayerFactory = (
  planet: 'earth' | 'moon' | 'mars',
  options?: Partial<{
    name: string;
    features: Feature[];
    color: string;
    shape: ShapeType;
    isTemporary: boolean;
    styleFn: (f: FeatureLike) => Style | Style[];
    geometryType: GeometryType;
    useVectorImage?: boolean;
  }>,
  idGenerator?: () => string
) => LayerConfig;

export function createVectorLayerFactory(styleService: StyleService): LayerFactory {
  return (planet, options, idGenerator) => {
    const {
      name = `Layer-${Date.now()}`,
      features = [],
      color = '#ff6600',
      shape = 'circle',
      isTemporary = false,
      styleFn,
      geometryType: givenGeometryType,
      useVectorImage = false
    } = options || {};

    const geometryType: GeometryType = givenGeometryType ?? detectGeometryType(features);
    let configRef: LayerConfig;

    const LayerConstructor = useVectorImage ? VectorImageLayer : VectorLayer;

    const vectorLayer = new LayerConstructor({
      source: new VectorSource({ features }),
      updateWhileInteracting: true, 
      style: (feature: FeatureLike) => {
        if (styleFn) return styleFn(feature);

        const feat = feature as Feature;
        const baseColor = feat.get('hoverColor') || feat.get('color') || configRef?.color || color;
        const fType = feat.get('featureType') as string | undefined;

        if (fType === 'label') {
          return styleService.getLayerStyle({
            type: 'label',
            baseColor: baseColor,
            text: feat.get('text'),
            position: feat.get('labelPosition')
          });
        }

        let resolvedType: GeometryType;
        if (fType === 'line' || fType === 'polygon' || fType === 'point') {
          resolvedType = fType as GeometryType;
        } else {
          const geomType = feat.getGeometry()?.getType();
          if (geomType?.includes('LineString')) resolvedType = 'line';
          else if (geomType?.includes('Polygon')) resolvedType = 'polygon';
          else resolvedType = configRef?.geometryType ?? 'point';
        }

        return styleService.getLayerStyle({
          type: resolvedType,
          baseColor: baseColor,
          shape: configRef?.shape || shape,
        });
      }
    });

    const config: LayerConfig = {
      id: idGenerator ? idGenerator() : `tmp:${planet}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
      name,
      color,
      shape,
      visible: true,
      olLayer: vectorLayer,
      isTemporary,
      planet,
      styleFn,
      features,
      geometryType,
      isTileLayer: false
    };

    configRef = config;
    return config;
  };
}

function detectGeometryType(features: Feature[]): GeometryType {
  let hasLine = false;
  let hasPolygon = false;
  for (const f of features) {
    const geom = f.getGeometry();
    if (!geom) continue;
    const gType = geom.getType();
    if (gType.includes('LineString')) hasLine = true;
    else if (gType.includes('Polygon')) hasPolygon = true;
  }
  return hasLine ? 'line' : hasPolygon ? 'polygon' : 'point';
}
