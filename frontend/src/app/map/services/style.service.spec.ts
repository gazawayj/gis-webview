/**
 * @file style.service.spec.ts
 * @description Unit tests for StyleService.
 */
import '../../../test-setup'; 
import { describe, it, expect, beforeEach } from 'vitest';
import { StyleService } from './style.service';
import { ShapeType } from '../constants/symbol-constants';
import { Style, Fill, Text } from 'ol/style';

describe('StyleService', () => {
  let service: StyleService;

  beforeEach(() => {
    service = new StyleService();
  });

  /**
   * TEST: Hex Color Math
   */
  it('should correctly brighten a hex color', () => {
    // Standard mid-grey brightening
    expect(service.brightenHex('#808080', 1.5)).toBe('#c0c0c0');

    // 3-digit hex expansion (#f00 -> #ff0000)
    expect(service.brightenHex('#f00', 1.0)).toBe('#ff0000');

    // Clamping at white (255)
    expect(service.brightenHex('#ffffff', 2.0)).toBe('#ffffff');

    // Black stays black with multiplication
    expect(service.brightenHex('#000000', 5.0)).toBe('#000000');
  });

  /**
   * TEST: Style Allocation
   */
  it('should allocate unique colors and shapes for a planet', () => {
    service.resetPlanet('mars');

    const style1 = service.allocateLayerStyle('mars');
    const style2 = service.allocateLayerStyle('mars');

    expect(style1.color).not.toBe(style2.color);
    expect(style1.shape).not.toBe(style2.shape);
    expect(style1.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('should reset usage tracking when resetPlanet is called', () => {
    service.allocateLayerStyle('earth');
    service.resetPlanet('earth');
    
    // Using private access to verify state reset
    expect((service as any).planetColorUsage['earth'].size).toBe(0);
    expect((service as any).planetShapeUsage['earth'].size).toBe(0);
  });

  /**
   * TEST: Style Generation
   */
  it('should generate a valid Style object for points with specific shapes', () => {
    const olStyle = service.getLayerStyle({
      type: 'point',
      baseColor: '#00ff00',
      shape: 'star'
    });

    expect(olStyle).toBeInstanceOf(Style);
    const image = olStyle.getImage();
    expect(image).toBeDefined();
    // RegularShape is used for stars
    expect(image?.constructor.name).toBe('RegularShape');
  });

  it('should handle label visibility logic for black text', () => {
    const olStyle = service.getLayerStyle({
      type: 'label',
      baseColor: '#000000',
      text: 'Invisible?'
    });

    const textStyle = olStyle.getText();
    expect(textStyle).toBeDefined();
    // Logic: if color is #000000, use #ffffff for fill
    const fill = textStyle?.getFill() as Fill;
    expect(fill.getColor()).toBe('#ffffff');
  });

  it('should apply 50% opacity (88) to polygon fill colors', () => {
    const baseColor = '#ff0000';
    const olStyle = service.getLayerStyle({
      type: 'polygon',
      baseColor
    });

    const fill = olStyle.getFill();
    expect(fill?.getColor()).toBe('#ff000088');
    
    // Verify border is brightened
    const stroke = olStyle.getStroke();
    expect(stroke?.getColor()).toBe(service.brightenHex(baseColor, 0.6));
  });

  it('should provide a default circle style for unknown types', () => {
    const olStyle = (service as any).getLayerStyle({
      type: 'invalid-type'
    });

    expect(olStyle.getImage()?.constructor.name).toBe('CircleStyle');
  });
});
