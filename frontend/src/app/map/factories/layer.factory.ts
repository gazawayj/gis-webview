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
    shape: ShapeType;
    isTemporary: boolean;
    styleFn: (f: FeatureLike) => Style | Style[];
    geometryType: GeometryType;
  }>,
  idGenerator?: () => string
) => LayerConfig;

export function createVectorLayerFactory(styleService: StyleService): LayerFactory {
  return (planet, options, idGenerator) => {
    const {
      name = `Layer-${Date.now()}`,
      features = [],
      color = styleService.getRandomColor(),
      shape,
      isTemporary = false,
      styleFn,
      geometryType: optGeometryType,
    } = options || {};

    // ------------------- Determine layer-wide shape -------------------
    const layerShape: ShapeType = shape || styleService.getRandomShape();

    // ------------------- Detect geometry type -------------------
    const geometryType: GeometryType = optGeometryType ?? detectGeometryType(features);

    let configRef!: LayerConfig;

    // ------------------- Clone features and attach layer-wide shape -------------------
    const clonedFeatures = features.map(f => {
      const clone = f.clone();
      const fType = clone.get('featureType');
      if (fType === 'point' || fType === 'vertex') {
        clone.set('shape', layerShape); // enforce valid layer-wide shape
      }
      return clone;
    });

    // ------------------- Create OpenLayers vector layer -------------------
    const vectorLayer = new VectorLayer({
      source: new VectorSource({ features: clonedFeatures }),
      style: (feature: FeatureLike) => {
        if (styleFn) return styleFn(feature);

        const feat = feature as Feature;
        const fType = feat.get('featureType') as string | undefined;

        // Labels
        if (fType === 'label') {
          return styleService.getLayerStyle({
            type: 'label',
            baseColor: configRef.color,
            text: feat.get('text') as string | undefined,
          });
        }

        // Determine rendering geometry type
        let type: GeometryType = 'point';
        if (fType === 'line' || configRef.geometryType === 'line') type = 'line';
        else if (fType === 'polygon' || configRef.geometryType === 'polygon') type = 'polygon';

        // Vertices/points use only valid layerShape
        const symbolShape =
          fType === 'point' || fType === 'vertex'
            ? (feat.get('shape') as ShapeType) || configRef.shape
            : undefined;

        return styleService.getLayerStyle({
          type,
          baseColor: configRef.color,
          shape: symbolShape,
        });
      },
    });

    // ------------------- LayerConfig -------------------
    const config: LayerConfig = {
      id: idGenerator
        ? idGenerator()
        : `tmp:${planet}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
      name,
      color,
      shape: layerShape,
      visible: true,
      olLayer: vectorLayer,
      isTemporary,
      planet,
      styleFn,
      features: clonedFeatures,
      geometryType,
    };

    // Needed in style closure
    configRef = config;

    return config;
  };
}

// ------------------- Geometry detection helper -------------------
function detectGeometryType(features: Feature[]): GeometryType {
  if (features.length) {
    for (const f of features) {
      const geomType = f.getGeometry()?.getType();
      if (geomType === 'LineString' || geomType === 'MultiLineString') return 'line';
      if (geomType === 'Polygon' || geomType === 'MultiPolygon') return 'polygon';
    }
  }
  // Default to 'point'; vertices will use layerShape
  return 'point';
}