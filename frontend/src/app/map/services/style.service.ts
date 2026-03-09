import { Injectable } from '@angular/core';
import { Style, Circle as CircleStyle, Fill, Stroke, RegularShape, Icon, Text } from 'ol/style';
import { SHAPES, COLOR_PALETTE, ShapeType } from '../constants/symbol-constants';

type Planet = 'earth' | 'moon' | 'mars';

/**
 * Service to manage styles for map layers and features.
 * Handles color/shape allocation per planet and creates OpenLayers styles.
 */
@Injectable({ providedIn: 'root' })
export class StyleService {
  /** Tracks used colors per planet to avoid duplicates */
  private planetColorUsage: Record<Planet, Set<string>> = { earth: new Set(), moon: new Set(), mars: new Set() };

  /** Tracks used shapes per planet to avoid duplicates */
  private planetShapeUsage: Record<Planet, Set<ShapeType>> = { earth: new Set(), moon: new Set(), mars: new Set() };

  /** Caches assigned shapes per layer ID */
  private layerShapeCache = new Map<string, ShapeType>();

  /**
   * Resets the style tracking for a planet.
   * @param planet - Planet whose color/shape usage is cleared
   */
  resetPlanet(planet: Planet) {
    this.planetColorUsage[planet].clear();
    this.planetShapeUsage[planet].clear();
  }

  /**
   * Allocates a unique color and shape for a new layer on a planet.
   * Ensures even distribution of colors/shapes, wrapping when exhausted.
   * @param planet - Planet for which to allocate
   * @returns Object with `color` and `shape`
   */
  allocateLayerStyle(planet: Planet): { color: string; shape: ShapeType } {
    const usedColors = this.planetColorUsage[planet];
    const usedShapes = this.planetShapeUsage[planet];
    if (usedColors.size >= COLOR_PALETTE.length) usedColors.clear();
    if (usedShapes.size >= SHAPES.length) usedShapes.clear();

    const availableColors = COLOR_PALETTE.filter(c => !usedColors.has(c));
    const availableShapes = SHAPES.filter(s => !usedShapes.has(s));

    const color = availableColors[Math.floor(Math.random() * availableColors.length)] || '#ff6600';
    const shape = availableShapes[Math.floor(Math.random() * availableShapes.length)] || 'circle';

    usedColors.add(color);
    usedShapes.add(shape);
    return { color, shape };
  }

  /**
   * Stores a fixed shape for a specific layer ID.
   * @param layerId - ID of the layer
   * @param shape - Shape to assign
   */
  setLayerShape(layerId: string, shape: ShapeType) {
    this.layerShapeCache.set(layerId, shape);
  }

  /**
   * Returns an OpenLayers `Style` for a feature based on type.
   * @param options - Options including type, baseColor, shape, text, and label position
   */
  getLayerStyle(options: {
    type: 'point' | 'line' | 'label' | 'polygon',
    baseColor?: string,
    shape?: ShapeType,
    text?: string,
    position?: 'top' | 'bottom'
  }): Style {
    const color = options.baseColor || '#ff6600';

    switch (options.type) {
      case 'point': {
        return new Style({ image: this.createShapeImage(options.shape || 'circle', color) });
      }
      case 'line': {
        return new Style({ stroke: new Stroke({ color, width: 3 }) });
      }
      case 'polygon': {
        let fillColor = color;
        if (/^#[0-9A-Fa-f]{6}$/.test(color)) fillColor += '88';
        return new Style({
          fill: new Fill({ color: fillColor }),
          stroke: new Stroke({ color: this.brightenHex(color, 0.6), width: 2 })
        });
      }
      case 'label': {
        const offsetY = options.position === 'bottom' ? 15 : -15;
        return new Style({
          text: new Text({
            text: options.text || '',
            font: 'bold 14px sans-serif',
            fill: new Fill({ color: color === '#000000' ? '#ffffff' : color }),
            stroke: new Stroke({ color: '#000', width: 3 }),
            offsetY,
            textAlign: 'center'
          })
        });
      }
      default: {
        return new Style({
          image: new CircleStyle({
            radius: 5,
            fill: new Fill({ color }),
            stroke: new Stroke({ color: '#000', width: 1 })
          })
        });
      }
    }
  }

  /**
   * Creates a point-style `ol/style` object based on shape type.
   * Supports geometric shapes, arrows, and circles.
   * @param shape - Shape type
   * @param color - Fill color
   */
  private createShapeImage(shape: ShapeType, color: string) {
    const lower = shape.toLowerCase();
    const pointsMap: Record<string, number> = { square: 4, triangle: 3, diamond: 4, pentagon: 5, hexagon: 6, star: 5 };

    if (pointsMap[lower]) {
      const radius2 = lower === 'star' ? 3 : undefined;
      const angle = lower === 'square' ? Math.PI / 4 : 0;
      return new RegularShape({
        points: pointsMap[lower],
        radius: 6,
        radius2,
        angle,
        fill: new Fill({ color }),
        stroke: new Stroke({ color: '#000', width: 1 })
      });
    }

    if (lower === 'arrow') {
      return new Icon({
        src: 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://w3.org" width="20" height="20"><polygon points="10,2 16,10 12,10 12,18 8,18 8,10 4,10" fill="${color}" stroke="black"/></svg>`)
      });
    }

    return new CircleStyle({ radius: 5, fill: new Fill({ color }), stroke: new Stroke({ color: '#000', width: 1 }) });
  }

  /**
 * Brightens or darkens a hex color by a factor.
 * @param hex - Input hex color (#rgb or #rrggbb)
 * @param factor - Brightness factor (>1 to brighten, <1 to darken)
 * @returns Adjusted hex color string
 */
  brightenHex(hex: string, factor: number): string {
    if (!hex?.startsWith('#')) return hex;

    // Expand 3-digit hex to 6-digit
    if (hex.length === 4) {
      hex = '#' + [...hex.slice(1)].map(c => c + c).join('');
    }

    // Convert each channel, scale, clamp, and convert back
    const rgb = hex.slice(1).match(/.{2}/g)?.map(c =>
      Math.min(255, Math.max(0, Math.round(parseInt(c, 16) * factor)))
    );

    if (!rgb) return hex;
    return '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join('');
  }
}
