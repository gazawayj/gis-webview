export const SHAPES = [
  'circle',
  'square',
  'triangle',
  'diamond',
  'pentagon',
  'hexagon',
  'star',
  'arrow'
] as const;

export type ShapeType = typeof SHAPES[number];

export const COLOR_PALETTE = [
  '#e6194b','#3cb44b','#ffe119','#4363d8','#f58231',
  '#911eb4','#46f0f0','#f032e6','#d3e05f','#fabebe',
  '#008080','#e6beff','#9a6324','#fffac8','#800000',
  '#aaffc3','#808000','#ffd8b1','#1eff00','#8b5656'
] as const;