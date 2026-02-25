import { Injectable } from '@angular/core';
import { Style, Circle as CircleStyle, Fill, Stroke, RegularShape, Icon, Text } from 'ol/style';
import { SHAPES, COLOR_PALETTE, ShapeType } from './symbol-constants';

@Injectable({ providedIn: 'root' })
export class StyleService {

  private colorsPool = [...COLOR_PALETTE];
  private shapesPool = [...SHAPES];

  private usedColors: Set<string> = new Set();
  private usedShapes: Set<ShapeType> = new Set();

  constructor() { }

  /** ================= RANDOM GENERATORS ================= */
  getRandomColor(): string {
    if (this.usedColors.size >= this.colorsPool.length) this.usedColors.clear();
    const available = this.colorsPool.filter(c => !this.usedColors.has(c));
    const color = available[Math.floor(Math.random() * available.length)];
    this.usedColors.add(color);
    return color;
  }

  getRandomShape(): ShapeType {
    if (this.usedShapes.size >= this.shapesPool.length) this.usedShapes.clear();
    const available = this.shapesPool.filter(s => !this.usedShapes.has(s));
    const shape = available[Math.floor(Math.random() * available.length)];
    this.usedShapes.add(shape);
    return shape;
  }

  /** ==================== MAIN STYLE GETTER ==================== */
  getLayerStyle(options: { type: 'point' | 'line' | 'label', baseColor?: string, shape?: ShapeType, text?: string }): Style {
    switch (options.type) {
      case 'point': {
        const color = options.baseColor || this.getRandomColor();
        const shape = (options.shape && options.shape !== 'none') ? options.shape : 'circle';
        return new Style({ image: this.createShapeImage(shape, color) });
      }
      case 'line': {
        const color = options.baseColor || this.getRandomColor();
        return new Style({ stroke: new Stroke({ color, width: 3 }) });
      }
      case 'label': {
        const color = options.baseColor || this.getRandomColor();
        return new Style({
          text: new Text({
            text: options.text || '',
            font: 'bold 14px sans-serif',
            fill: new Fill({ color }),
            stroke: new Stroke({ color: '#000', width: 3 }),
            offsetY: -15
          })
        });
      }
      default: {
        const color = options.baseColor || this.getRandomColor();
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

  /** ==================== PRIVATE HELPERS ==================== */
  private createShapeImage(shape: ShapeType, color: string) {
    const lower = shape.toLowerCase();
    if (['square', 'triangle', 'diamond', 'pentagon', 'hexagon', 'star'].includes(lower)) {
      const pointsMap: Record<string, number> = { square: 4, triangle: 3, diamond: 4, pentagon: 5, hexagon: 6, star: 5 };
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
        src: 'data:image/svg+xml;utf8,' +
          encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">
            <polygon points="10,2 16,10 12,10 12,18 8,18 8,10 4,10" fill="${color}" stroke="black"/>
          </svg>`)
      });
    }

    return new CircleStyle({ radius: 5, fill: new Fill({ color }), stroke: new Stroke({ color: '#000', width: 1 }) });
  }
}