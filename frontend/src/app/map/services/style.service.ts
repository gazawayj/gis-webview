import { Injectable } from '@angular/core';
import { Style, Circle as CircleStyle, Fill, Stroke, RegularShape, Icon } from 'ol/style';
import { SHAPES, COLOR_PALETTE, ShapeType } from './symbol-constants';

@Injectable({ providedIn: 'root' })
export class StyleService {

  private cache: Record<string, Style> = {};

  /** Pools for random assignment */
  private colorsPool = [...COLOR_PALETTE];
  private shapesPool = [...SHAPES];

  private usedColors: Set<string> = new Set();
  private usedShapes: Set<ShapeType> = new Set();

  constructor() { }

  /** Returns a unique random color (resets when exhausted) */
  getRandomColor(): string {
    if (this.usedColors.size >= this.colorsPool.length) {
      this.usedColors.clear();
    }
    const available = this.colorsPool.filter(c => !this.usedColors.has(c));
    const color = available[Math.floor(Math.random() * available.length)];
    this.usedColors.add(color);
    return color;
  }

  /** Returns a unique random shape (resets when exhausted) */
  getRandomShape(): ShapeType {
    if (this.usedShapes.size >= this.shapesPool.length) {
      this.usedShapes.clear();
    }
    const available = this.shapesPool.filter(s => !this.usedShapes.has(s));
    const shape = available[Math.floor(Math.random() * available.length)];
    this.usedShapes.add(shape);
    return shape;
  }

  /** Convenience: get both color and shape for a new layer */
  getRandomStyleProps(): { color: string, shape: ShapeType } {
    return {
      color: this.getRandomColor(),
      shape: this.getRandomShape()
    };
  }

  /** Style generator */
  getStyle(color: string, shape: string): Style {
    const key = `${shape}-${color}`;
    if (this.cache[key]) return this.cache[key];

    let image;
    let stroke: Stroke | undefined;

    switch (shape.toLowerCase()) {
      case 'square':
        image = new RegularShape({ points: 4, radius: 5, angle: Math.PI / 4, fill: new Fill({ color }), stroke: new Stroke({ color: '#000', width: 1 }) });
        break;

      case 'triangle':
        image = new RegularShape({ points: 3, radius: 6, fill: new Fill({ color }), stroke: new Stroke({ color: '#000', width: 1 }) });
        break;

      case 'diamond':
        image = new RegularShape({ points: 4, radius: 5, fill: new Fill({ color }), stroke: new Stroke({ color: '#000', width: 1 }) });
        break;

      case 'pentagon':
        image = new RegularShape({ points: 5, radius: 6, fill: new Fill({ color }), stroke: new Stroke({ color: '#000', width: 1 }) });
        break;

      case 'hexagon':
        image = new RegularShape({ points: 6, radius: 6, fill: new Fill({ color }), stroke: new Stroke({ color: '#000', width: 1 }) });
        break;

      case 'star':
        image = new RegularShape({ points: 5, radius: 6, radius2: 3, fill: new Fill({ color }), stroke: new Stroke({ color: '#000', width: 1 }) });
        break;

      case 'arrow':
        image = new Icon({
          src: 'data:image/svg+xml;utf8,' +
            encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">
          <polygon points="10,2 16,10 12,10 12,18 8,18 8,10 4,10" fill="${color}" stroke="black"/>
          </svg>`)
        });
        break;

      case 'line':
        stroke = new Stroke({ color, width: 3 });
        break;

      default:
        image = new CircleStyle({ radius: 5, fill: new Fill({ color }), stroke: new Stroke({ color: '#000', width: 1 }) });
    }

    const styleConfig: any = {};
    if (image) styleConfig.image = image;
    if (stroke) styleConfig.stroke = stroke;

    return this.cache[key] = new Style(styleConfig);
  }
}
