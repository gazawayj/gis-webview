import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class UniqueSymbolService {

  readonly COLOR_PALETTE = ['#3498db', '#e74c3c', '#f1c40f', '#2ecc71', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'];
  readonly SHAPES = ['circle', 'square', 'triangle', 'diamond', 'pentagon', 'hexagon', 'star', 'arrow'];

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