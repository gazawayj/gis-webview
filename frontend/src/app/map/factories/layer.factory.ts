import { Feature } from 'ol';
import { FeatureLike } from 'ol/Feature';
import { Style } from 'ol/style';
import { ShapeType } from '../constants/symbol-constants';
import { LayerConfig, GeometryType } from '../models/layer-config.model';
import VectorLayer from 'ol/layer/Vector';
import VectorImageLayer from 'ol/layer/VectorImage';
import VectorSource from 'ol/source/Vector';
import { StyleService } from '../services/style.service';

/**
 * Function type for creating a new layer configuration.
 *
 * @param planet - Target planet for the layer ('earth', 'moon', 'mars')
 * @param options - Partial options for the layer, including:
 *   - name: Optional layer name
 *   - features: Optional array of OL features
 *   - color: Base color for the layer
 *   - shape: Shape type for point geometries
 *   - isTemporary: Marks the layer as temporary (e.g., for tools)
 *   - styleFn: Optional custom style function
 *   - geometryType: Optional override for geometry type
 *   - useVectorImage: Whether to use VectorImageLayer instead of VectorLayer
 * @param idGenerator - Optional function to generate unique layer IDs
 * @returns Configured LayerConfig object
 */
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

/**
 * Creates a vector layer factory function with access to the StyleService.
 *
 * @param styleService - The style service for generating OL styles
 * @returns A LayerFactory function to create layers dynamically
 */
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

    // Creates the OL vector layer with dynamic styling
    const vectorLayer = new LayerConstructor({
      source: new VectorSource({ features }),
      updateWhileInteracting: true,
      style: (feature: FeatureLike) => {
        // Use custom style function if provided
        if (styleFn) return styleFn(feature);

        const feat = feature as Feature;
        const baseColor = feat.get('hoverColor') || feat.get('color') || configRef?.color || color;
        const fType = feat.get('featureType') as string | undefined;

        // Special handling for labels
        if (fType === 'label') {
          return styleService.getLayerStyle({
            type: 'label',
            baseColor: baseColor,
            text: feat.get('text'),
            position: feat.get('labelPosition')
          });
        }

        // Determine geometry type for styling
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

/**
 * Detects the overall geometry type of a feature collection.
 * Priority: line > polygon > point
 *
 * @param features - Array of OL features
 * @returns GeometryType string ('line', 'polygon', 'point')
 */
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
