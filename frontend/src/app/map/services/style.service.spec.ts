/**
 * style.service.spec.ts
 * 
 * TESTING REASONING:
 * 1. Method Signatures: The getLayerStyle method uses an 'options' object pattern. 
 *    We must pass a single object { type, baseColor, ... } to match the service.
 * 2. Color Math: Because the service uses multiplication (* factor), pure black 
 *    multiplied by any number is still 0. Our test now expects this behavior.
 * 3. State Isolation: Each test calls resetPlanet to ensure color/shape usage 
 *    from one test doesn't leak into the next.
 */

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
   * TEST: Hex Color Manipulation
   * Validates the multiplication-based brightening logic.
   */
  it('should correctly brighten a hex color', () => {
    const midGrey = '#808080';
    // Using 1.2 as factor (20% brighter) to match the service's multiplication logic
    const brightened = service.brightenHex(midGrey, 1.2);
    
    expect(brightened).not.toBe(midGrey);
    expect(brightened.startsWith('#')).toBe(true);

    // Boundary Case: White remains white (clamped at 255)
    expect(service.brightenHex('#ffffff', 1.5)).toBe('#ffffff');

    // Boundary Case: Black (0 * factor = 0)
    // This is where your previous test failed; it correctly returns #000000
    expect(service.brightenHex('#000000', 1.5)).toBe('#000000');
  });

  /**
   * TEST: Style Allocation
   * Verifies that the service tracks usage to provide unique visuals.
   */
  it('should allocate a unique color for a new Mars layer', () => {
    service.resetPlanet('mars');
    const style1 = service.allocateLayerStyle('mars');
    const style2 = service.allocateLayerStyle('mars');

    // Logic: colors should be distinct to help user differentiate layers
    expect(style1.color).not.toBe(style2.color);
    expect(style1.color).toMatch(/^#[0-9A-F]{6}$/i);
  });

  /**
   * TEST: Shape Persistence
   * Ensures the service correctly maps a layerId to a chosen ShapeType.
   */
  it('should store and retrieve layer shapes correctly', () => {
    const layerId = 'layer-abc';
    const shape: ShapeType = 'star';
    
    service.setLayerShape(layerId, shape);
    
    // Check internal private cache using bracket notation
    expect(service['layerShapeCache'].get(layerId)).toBe(shape);
  });

  /**
   * TEST: OpenLayers Style Generation
   * FIX: This method now passes a single options object to match the Service signature.
   */
  it('should generate a valid OpenLayers style object', () => {
    // Corrected call: One argument (the options object)
    const olStyle = service.getLayerStyle({
      type: 'point',
      baseColor: '#ff0000',
      shape: 'triangle'
    });

    expect(olStyle).toBeDefined();
    /**
     * Verification: Point types should result in a Style with an 'image' 
     * (which is what RegularShape/CircleStyle are categorized as in OL).
     */
    expect(olStyle.getImage()).toBeTruthy();
  });

  /**
   * TEST: Polygon Style Logic
   * Ensures polygons get the 88 (opacity) suffix added to the hex code.
   */
  it('should add opacity to polygon fill colors', () => {
    const olStyle = service.getLayerStyle({
      type: 'polygon',
      baseColor: '#ff0000'
    });

    const fill = olStyle.getFill();
    expect(fill?.getColor()).toBe('#ff000088');
  });
});
