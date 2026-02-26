import { Injectable } from '@angular/core';
import { SHAPES, COLOR_PALETTE } from '../constants/symbol-constants';

@Injectable({ providedIn: 'root' })
export class UniqueSymbolService {

  readonly COLOR_PALETTE = COLOR_PALETTE;
  readonly SHAPES = SHAPES;

  pickUnique(used: Set<string>): { color: string; shape: string } {
    const maxAttempts = 200;
    let attempts = 0;

    while (attempts++ < maxAttempts) {
      const color = this.COLOR_PALETTE[Math.floor(Math.random() * this.COLOR_PALETTE.length)];
      const shape = this.SHAPES[Math.floor(Math.random() * this.SHAPES.length)];
      const key = `${color}-${shape}`;

      if (!used.has(key)) return { color, shape };
    }

    return { color: this.COLOR_PALETTE[0], shape: this.SHAPES[0] };
  }
}