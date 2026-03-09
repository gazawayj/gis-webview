/** -------------------- Area / Perimeter Formatting -------------------- **/
export function formatAreaPerimeter( areaMeters: number, perimeterMeters: number ): { area: string; perimeter: string } {
  let areaStr = '';
  let perimeterStr = '';

  if (!isNaN(areaMeters) && areaMeters > 0) {
    const areaKm2 = areaMeters / 1_000_000;
    areaStr = `${areaKm2.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    })} km²`;
  }

  if (!isNaN(perimeterMeters) && perimeterMeters > 0) {
    const perimeterKm = perimeterMeters / 1000;
    perimeterStr = `${perimeterKm.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })} km`;
  }

  return {
    area: areaStr,
    perimeter: perimeterStr
  };
}

/** -------------------- KD-Tree Utilities -------------------- **/

/**
 * Node of a 2D KD-Tree
 */
export class KDNode {
  point: [number, number];
  left: KDNode | null = null;
  right: KDNode | null = null;
  axis: 0 | 1;

  constructor(point: [number, number], axis: 0 | 1) {
    this.point = point;
    this.axis = axis;
  }
}

/**
 * Lightweight 2D KD-Tree for fast nearest-neighbor searches
 */
export class KDTree {
  root: KDNode | null;

  constructor(points: [number, number][]) {
    this.root = this.build(points, 0);
  }

  /**
   * Recursively builds the KD-tree.
   * @param points Array of [x, y] points
   * @param depth Current depth (used to alternate axis)
   */
  private build(points: [number, number][], depth: number): KDNode | null {
    if (!points.length) return null;

    const axis: 0 | 1 = (depth % 2) as 0 | 1;
    points.sort((a, b) => a[axis] - b[axis]);

    const mid = Math.floor(points.length / 2);
    const node = new KDNode(points[mid], axis);
    node.left = this.build(points.slice(0, mid), depth + 1);
    node.right = this.build(points.slice(mid + 1), depth + 1);

    return node;
  }

  /**
   * Finds the nearest neighbor to a given point.
   * @param point [x, y] query point
   * @returns Closest point in the tree or null if empty
   */
  nearest(point: [number, number]): [number, number] | null {
    let best: [number, number] | null = null;
    let bestDist = Infinity;

    const distance = (a: [number, number], b: [number, number]) =>
      Math.hypot(a[0] - b[0], a[1] - b[1]);

    const search = (node: KDNode | null) => {
      if (!node) return;

      const d = distance(point, node.point);
      if (d < bestDist && d > 0) {
        bestDist = d;
        best = node.point;
      }

      const axis = node.axis;
      const diff = point[axis] - node.point[axis];

      const first = diff <= 0 ? node.left : node.right;
      const second = diff <= 0 ? node.right : node.left;

      search(first);
      if (Math.abs(diff) < bestDist) search(second);
    };

    search(this.root);
    return best;
  }
}