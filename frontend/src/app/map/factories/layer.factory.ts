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
      color,
      shape,
      isTemporary = false,
      styleFn,
      geometryType: givenGeometryType,
      useVectorImage = false
    } = options || {};

    if (!color || !shape) {
      throw new Error('LayerFactory requires color and shape.');
    }

    const geometryType: GeometryType = givenGeometryType ?? detectGeometryType(features);

    let configRef!: LayerConfig;

    const LayerConstructor = useVectorImage ? VectorImageLayer : VectorLayer;

    const vectorLayer = new LayerConstructor({
      source: new VectorSource({ features }),
      style: (feature: FeatureLike) => {
        if (styleFn) return styleFn(feature);

        const feat = feature as Feature;
        const fType = feat.get('featureType') as string | undefined;

        // Label features: respect the feature's labelPosition property
        if (fType === 'label') {
          const text = feat.get('text') as string | undefined;
          const position = feat.get('labelPosition') as 'top' | 'bottom' | undefined;
          return styleService.getLayerStyle({
            type: 'label',
            baseColor: configRef.color,
            text,
            position
          });
        }

        // Resolve geometry type priority
        let resolvedType: GeometryType;
        if (fType === 'line' || fType === 'polygon' || fType === 'point') {
          resolvedType = fType as GeometryType;
        } else {
          const geom = feat.getGeometry();
          const geomType = geom?.getType();
          if (geomType?.includes('LineString')) resolvedType = 'line';
          else if (geomType?.includes('Polygon')) resolvedType = 'polygon';
          else resolvedType = configRef.geometryType ?? 'point';
        }

        return styleService.getLayerStyle({
          type: resolvedType,
          baseColor: configRef.color,
          shape: configRef.shape,
        });
      }
    });

    const config: LayerConfig = {
      id: idGenerator
        ? idGenerator()
        : `tmp:${planet}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
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

    const geomType = geom.getType();
    const fType = f.get('featureType') as string | undefined;

    if (geomType === 'Point' && fType === 'vertex') continue;
    if (geomType.includes('LineString')) hasLine = true;
    else if (geomType.includes('Polygon')) hasPolygon = true;
  }

  if (hasLine) return 'line';
  if (hasPolygon) return 'polygon';
  return 'point';
}