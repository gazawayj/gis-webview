/**
 * @file layer.factory.spec.ts
 * @description Unit tests for the vector layer factory.
 */

import '../../../test-setup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createVectorLayerFactory } from './layer.factory';
import Feature from 'ol/Feature';
import { Point, LineString } from 'ol/geom';
import VectorLayer from 'ol/layer/Vector';
import VectorImageLayer from 'ol/layer/VectorImage';

describe('LayerFactory', () => {
  let styleServiceMock: any;
  let factory: any;

  beforeEach(() => {
    styleServiceMock = {
      getLayerStyle: vi.fn().mockReturnValue([])
    };
    factory = createVectorLayerFactory(styleServiceMock);
  });

  it('should create a valid LayerConfig with default values', () => {
    const config = factory('earth');

    expect(config.planet).toBe('earth');
    expect(config.name).toMatch(/Layer-\d+/);
    expect(config.color).toBe('#ff6600');
    expect(config.olLayer).toBeDefined();
  });

  it('should use VectorImageLayer when requested', () => {
    const config = factory('mars', { useVectorImage: true });
    expect(config.olLayer).toBeInstanceOf(VectorImageLayer);
  });

  describe('Dynamic Styling Logic', () => {
    /**
     * Helper to safely get and call the style function from a mocked layer
     */
    const getLayerStyleFn = (layer: any) => {
      // In many mock setups, we store the style in an internal property 
      // or we can use the getStyle() method if the mock supports it.
      return layer.getStyle ? layer.getStyle() : null;
    };

    it('should use custom styleFn if provided in options', () => {
      const mockStyle = { color: 'red' } as any;
      const customStyleFn = vi.fn().mockReturnValue(mockStyle);
      const config = factory('earth', { styleFn: customStyleFn });
      
      const feature = new Feature(new Point([0, 0]));
      const styleFn = getLayerStyleFn(config.olLayer);
      
      const result = styleFn(feature);

      expect(customStyleFn).toHaveBeenCalledWith(feature);
      expect(result).toBe(mockStyle);
    });

    it('should call styleService with "label" parameters for label features', () => {
      const labelFeat = new Feature(new Point([0, 0]));
      labelFeat.set('featureType', 'label');
      labelFeat.set('text', 'Mars Base');
      labelFeat.set('labelPosition', 'top');

      const config = factory('mars');
      const styleFn = getLayerStyleFn(config.olLayer);
      
      styleFn(labelFeat);

      expect(styleServiceMock.getLayerStyle).toHaveBeenCalledWith(expect.objectContaining({
        type: 'label',
        text: 'Mars Base',
        position: 'top'
      }));
    });

    it('should prioritize hoverColor from feature properties', () => {
      const feat = new Feature(new Point([0, 0]));
      feat.set('hoverColor', '#ffffff');

      const config = factory('earth', { color: '#000000' });
      const styleFn = getLayerStyleFn(config.olLayer);
      
      styleFn(feat);

      expect(styleServiceMock.getLayerStyle).toHaveBeenCalledWith(expect.objectContaining({
        baseColor: '#ffffff'
      }));
    });

    it('should resolve type from geometry if featureType is missing', () => {
      const lineFeat = new Feature(new LineString([[0, 0], [1, 1]]));
      const config = factory('moon');
      const styleFn = getLayerStyleFn(config.olLayer);
      
      styleFn(lineFeat);

      expect(styleServiceMock.getLayerStyle).toHaveBeenCalledWith(expect.objectContaining({
        type: 'line'
      }));
    });
  });
});
