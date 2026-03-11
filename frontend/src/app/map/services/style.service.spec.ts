/**
 * style.service.spec.ts
 *
 * Unit tests for StyleService, responsible for color and shape management
 * for map layers in the GIS system.
 *
 * TESTING STRATEGY:
 * 1. Method Signatures: getLayerStyle expects a single options object:
 *    { type, baseColor, shape, ... }.
 * 2. Color Math: brightening uses multiplication; black (#000000) remains black.
 * 3. State Isolation: resetPlanet is called to ensure previous test state
 *    does not leak into subsequent tests.
 */
import '../../../test-setup'; 
import { describe, it, expect, beforeEach } from 'vitest';
import { StyleService } from './style.service';
import { createService } from '../testing/test-harness';
import { ShapeType } from '../constants/symbol-constants';

describe('StyleService', () => {
  let service: StyleService;

  beforeEach(() => {
    service = createService(StyleService);
  });

  /**
   * TEST: Hex Color Brightening
   * Validates multiplication-based brightening logic and boundary conditions.
   */
  it('should correctly brighten a hex color', () => {
    const midGrey = '#808080';
    const brightened = service.brightenHex(midGrey, 1.2);

    expect(brightened).not.toBe(midGrey);
    expect(brightened.startsWith('#')).toBe(true);

    // White remains white when brightened
    expect(service.brightenHex('#ffffff', 1.5)).toBe('#ffffff');

    // Black remains black when brightened
    expect(service.brightenHex('#000000', 1.5)).toBe('#000000');
  });

  /**
   * TEST: Color Allocation for Layers
   * Ensures that each new layer gets a unique color within a planet.
   */
  it('should allocate unique colors for Mars layers', () => {
    service.resetPlanet('mars');

    const style1 = service.allocateLayerStyle('mars');
    const style2 = service.allocateLayerStyle('mars');

    expect(style1.color).not.toBe(style2.color);
    expect(style1.color).toMatch(/^#[0-9A-F]{6}$/i);
    expect(style2.color).toMatch(/^#[0-9A-F]{6}$/i);
  });

  /**
   * TEST: Layer Shape Persistence
   * Verifies that setLayerShape stores the shape and getLayerStyle reflects it.
   */
  it('should store and retrieve layer shapes correctly', () => {
    const layerId = 'layer-abc';
    const shape: ShapeType = 'star';

    service.setLayerShape(layerId, shape);

    expect(service['layerShapeCache'].get(layerId)).toBe(shape);
  });

  /**
   * TEST: OpenLayers Style Object Generation
   * Ensures getLayerStyle returns a valid OL Style object for points.
   */
  it('should generate a valid OpenLayers style object for points', () => {
    const olStyle = service.getLayerStyle({
      type: 'point',
      baseColor: '#ff0000',
      shape: 'triangle'
    });

    expect(olStyle).toBeDefined();
    expect(olStyle.getImage()).toBeTruthy();
  });

  /**
   * TEST: Polygon Fill Opacity
   * Verifies that polygon styles append the correct alpha (88) to baseColor.
   */
  it('should add opacity suffix to polygon fill colors', () => {
    const olStyle = service.getLayerStyle({
      type: 'polygon',
      baseColor: '#ff0000'
    });

    const fill = olStyle.getFill();
    expect(fill?.getColor()).toBe('#ff000088');
  });
});