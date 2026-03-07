import { Injectable } from '@angular/core';
import { Style, Circle as CircleStyle, Fill, Stroke, RegularShape, Icon, Text } from 'ol/style';
import { SHAPES, COLOR_PALETTE, ShapeType } from '../constants/symbol-constants';

type Planet = 'earth' | 'moon' | 'mars';

@Injectable({ providedIn: 'root' })
export class StyleService {

  private planetColorUsage: Record<Planet, Set<string>> = {
    earth: new Set(),
    moon: new Set(),
    mars: new Set()
  };

  private planetShapeUsage: Record<Planet, Set<ShapeType>> = {
    earth: new Set(),
    moon: new Set(),
    mars: new Set()
  };

  private layerShapeCache = new Map<string, ShapeType>();

  constructor() { }

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

    const color = availableColors[Math.floor(Math.random() * availableColors.length)];
    const shape = availableShapes[Math.floor(Math.random() * availableShapes.length)];

    usedColors.add(color);
    usedShapes.add(shape);

    return { color, shape };
  }

  setLayerShape(layerId: string, shape: ShapeType) {
    this.layerShapeCache.set(layerId, shape);
  }

  getLayerStyle(options: {
    type: 'point' | 'line' | 'label' | 'polygon',
    baseColor?: string,  // optional
    shape?: ShapeType,
    text?: string,
    position?: 'top' | 'bottom'
  }): Style {

    let color = options.baseColor;

    switch (options.type) {

      case 'point': {
        return new Style({
          image: this.createShapeImage(options.shape!, color || '#ff6600')
        });
      }

      case 'line': {
        return new Style({
          stroke: new Stroke({ color: color || '#ff6600', width: 3 })
        });
      }

      case 'polygon': {
        // Subdivision-specific style
        if (color === 'subdivision') {
          return new Style({
            fill: new Fill({ color: options.baseColor || 'rgb(0,0,0)' }),
            stroke: new Stroke({ color: 'rgba(0, 0, 0, 0.68)', width: 2.5 })
          });
        }
        const fillColor = color ? color + '33' : 'rgba(100,200,150,0.25)';
        return new Style({
          fill: new Fill({ color: fillColor }),
          stroke: new Stroke({ color: color || '#000000', width: 2 })
        });
      }

      case 'label': {
        const offsetY = options.position === 'bottom' ? 15 : -15;
        return new Style({
          text: new Text({
            text: options.text || '',
            font: 'bold 14px sans-serif',
            fill: new Fill({ color: color || '#ffffff' }),
            stroke: new Stroke({ color: '#000', width: 3 }),
            offsetY,
            textAlign: 'center'
          })
        });
      }

      default:
        return new Style({
          image: new CircleStyle({
            radius: 5,
            fill: new Fill({ color: color || '#ff6600' }),
            stroke: new Stroke({ color: '#000', width: 1 })
          })
        });
    }
  }

  // ---------------- Shape Builder ----------------
  private createShapeImage(shape: ShapeType, color: string) {
    const lower = shape.toLowerCase();

    if (['square', 'triangle', 'diamond', 'pentagon', 'hexagon', 'star'].includes(lower)) {
      const pointsMap: Record<string, number> = {
        square: 4,
        triangle: 3,
        diamond: 4,
        pentagon: 5,
        hexagon: 6,
        star: 5
      };

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

    return new CircleStyle({
      radius: 5,
      fill: new Fill({ color }),
      stroke: new Stroke({ color: '#000', width: 1 })
    });
  }
}