import { Injectable } from '@angular/core';
import { SHAPES, COLOR_PALETTE } from '../constants/symbol-constants';

/**
 * Service for picking unique color/shape combinations from global palettes.
 * Ensures minimal collisions when assigning symbols to layers/features.
 */
@Injectable({ providedIn: 'root' })
export class UniqueSymbolService {

  /** Base color palette */
  readonly COLOR_PALETTE = COLOR_PALETTE;
  /** Base shape list */
  readonly SHAPES = SHAPES;

  /**
   * Picks a color/shape pair that is not yet in `used`.
   * Falls back to first palette entry if too many attempts.
   * @param used - Set of 'color-shape' strings already used
   * @returns Object with `color` and `shape`
   */
  pickUnique(used: Set<string>): { color: string; shape: string } {
    const maxAttempts = 200;
    let attempts = 0;

    while (attempts++ < maxAttempts) {
      const color = this.COLOR_PALETTE[Math.floor(Math.random() * this.COLOR_PALETTE.length)];
      const shape = this.SHAPES[Math.floor(Math.random() * this.SHAPES.length)];
      const key = `${color}-${shape}`;

      if (!used.has(key)) return { color, shape };
    }
    // fallback
    return { color: this.COLOR_PALETTE[0], shape: this.SHAPES[0] };
  }
}