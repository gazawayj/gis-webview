import { Injectable } from '@angular/core';
import { Style, Circle as CircleStyle, Fill, Stroke, RegularShape, Icon, Text } from 'ol/style';
import { SHAPES, COLOR_PALETTE, ShapeType } from '../constants/symbol-constants';

type Planet = 'earth' | 'moon' | 'mars';

@Injectable({ providedIn: 'root' })
export class StyleService {
  private planetColorUsage: Record<Planet, Set<string>> = { earth: new Set(), moon: new Set(), mars: new Set() };
  private planetShapeUsage: Record<Planet, Set<ShapeType>> = { earth: new Set(), moon: new Set(), mars: new Set() };
  private layerShapeCache = new Map<string, ShapeType>();

  resetPlanet(planet: Planet) {
    this.planetColorUsage[planet].clear();
    this.planetShapeUsage[planet].clear();
  }

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

  setLayerShape(layerId: string, shape: ShapeType) {
    this.layerShapeCache.set(layerId, shape);
  }

  getLayerStyle(options: {
    type: 'point' | 'line' | 'label' | 'polygon',
    baseColor?: string,
    shape?: ShapeType,
    text?: string,
    position?: 'top' | 'bottom'
  }): Style {
    const color = options.baseColor || '#ff6600';

    switch (options.type) {
      case 'point':
        return new Style({ image: this.createShapeImage(options.shape || 'circle', color) });
      case 'line':
        return new Style({ stroke: new Stroke({ color, width: 3 }) });
      case 'polygon':
        let fillColor = color;
        if (/^#[0-9A-Fa-f]{6}$/.test(color)) fillColor += '88'; 
        return new Style({
          fill: new Fill({ color: fillColor }),
          stroke: new Stroke({ color: this.brightenHex(color, 0.6), width: 2 })
        });
      case 'label':
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
      default:
        return new Style({
          image: new CircleStyle({
            radius: 5,
            fill: new Fill({ color }),
            stroke: new Stroke({ color: '#000', width: 1 })
          })
        });
    }
  }

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

  brightenHex(hex: string, factor: number): string {
    if (!hex || !hex.startsWith('#') || (hex.length !== 7 && hex.length !== 4)) return hex;
    let r, g, b;
    if (hex.length === 4) {
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } else {
      r = parseInt(hex.substr(1, 2), 16);
      g = parseInt(hex.substr(3, 2), 16);
      b = parseInt(hex.substr(5, 2), 16);
    }
    r = Math.min(255, Math.max(0, Math.round(r * factor)));
    g = Math.min(255, Math.max(0, Math.round(g * factor)));
    b = Math.min(255, Math.max(0, Math.round(b * factor)));
    const toHex = (v: number) => v.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
}
