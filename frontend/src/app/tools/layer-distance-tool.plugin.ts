import Feature from 'ol/Feature';
import { LineString, MultiPolygon, Point, Polygon } from 'ol/geom';
import { getLength } from 'ol/sphere';
import { PLANETS } from '../map/constants/map-constants';
import { ToolPluginBase } from './tool-base.plugin';
import { LayerConfig } from '../map/models/layer-config.model';
import { OverlayRef } from '@angular/cdk/overlay';

/** Lightweight KD-tree for 2D points */
class KDNode {
    point: [number, number];
    left: KDNode | null = null;
    right: KDNode | null = null;
    axis: 0 | 1;
    constructor(point: [number, number], axis: 0 | 1) {
        this.point = point;
        this.axis = axis;
    }
}

class KDTree {
    root: KDNode | null;

    constructor(points: [number, number][]) {
        this.root = this.build(points, 0);
    }

    private build(points: [number, number][], depth: number): KDNode | null {
        if (!points.length) return null;
        const axis: 0 | 1 = depth % 2 as 0 | 1;
        points.sort((a, b) => a[axis] - b[axis]);
        const mid = Math.floor(points.length / 2);
        const node = new KDNode(points[mid], axis);
        node.left = this.build(points.slice(0, mid), depth + 1);
        node.right = this.build(points.slice(mid + 1), depth + 1);
        return node;
    }

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

export class LayerDistanceToolPlugin extends ToolPluginBase {
    name = 'layer-distance';
    selectedLayers: [LayerConfig | null, LayerConfig | null] = [null, null];
    modalRef?: OverlayRef;
    onConfirmComplete?: () => void;
    private _closestPair: [[number, number], [number, number]] | null = null;

    private kdCache = new Map<string, KDTree>();
    private layerFeatureCounts = new Map<string, number>();

    protected override onActivate(): void { }
    protected override onDeactivate(): void {
        super.onDeactivate();
        this.selectedLayers = [null, null];
        this._closestPair = null;
        this.kdCache.clear();
        this.layerFeatureCounts.clear();
    }

    private createDistanceFeature(
        geom: LineString | Point,
        featureType: 'point' | 'vertex' | 'pointerVertex' | 'line' | 'label' | 'polygon',
        text?: string,
        parent?: Feature,
        selectable?: boolean,
        labelAbove?: boolean
    ): Feature {
        // Use the base helper for consistent cloning
        const f = this.createFeature(geom, featureType, text, parent, selectable, labelAbove);
        f.set('isTempDistanceFeature', true);
        return f;
    }

    private getLayerPoints(layer: LayerConfig): [number, number][] {
        const coords: [number, number][] = [];

        (layer.features || [])
            .filter(f => !f.get('isTempDistanceFeature'))
            .forEach(f => {
                const geom = f.getGeometry();
                if (!geom) return;

                const type = geom.getType();
                switch (type) {
                    case 'Point':
                        coords.push((geom as Point).getCoordinates() as [number, number]);
                        break;
                    case 'LineString':
                        coords.push(...(geom as LineString).getCoordinates() as [number, number][]);
                        break;
                    case 'Polygon':
                        (geom as Polygon).getCoordinates().forEach(ring => {
                            coords.push(...ring as [number, number][]);
                        });
                        break;
                    case 'MultiPolygon':
                        (geom as MultiPolygon).getCoordinates().forEach(poly => {
                            poly.forEach(ring => coords.push(...ring as [number, number][]));
                        });
                        break;
                    default:
                        break;
                }
            });

        return coords;
    }

    private getKDTree(layer: LayerConfig): KDTree {
        const points = this.getLayerPoints(layer);
        const lastCount = this.layerFeatureCounts.get(layer.id) ?? -1;
        if (!this.kdCache.has(layer.id) || points.length !== lastCount) {
            const tree = new KDTree(points);
            this.kdCache.set(layer.id, tree);
            this.layerFeatureCounts.set(layer.id, points.length);
        }
        return this.kdCache.get(layer.id)!;
    }

    computeDistance(layerA: LayerConfig, layerB: LayerConfig): number {
        if (!this.tempSource) return 0;

        const pointsA = this.getLayerPoints(layerA);
        const pointsB = this.getLayerPoints(layerB);
        if (!pointsA.length || !pointsB.length) return 0;

        const radius = PLANETS[this.layerManager.currentPlanet].radius;
        const treeB = this.getKDTree(layerB);

        let minDistance = Infinity;
        let closestPair: [[number, number], [number, number]] | null = null;

        for (const pA of pointsA) {
            const nearest = treeB.nearest(pA);
            if (!nearest) continue;

            const distanceMeters = getLength(new LineString([pA, nearest]), { radius });
            if (distanceMeters < minDistance) {
                minDistance = distanceMeters;
                closestPair = [pA, nearest];
            }
        }

        this._closestPair = closestPair;
        return minDistance === Infinity ? 0 : minDistance;
    }

    confirm() {
        if (!this.tempSource || !this.selectedLayers[0] || !this.selectedLayers[1]) return;
        const [layerA, layerB] = this.selectedLayers;

        this.tempSource.clear();

        const distanceMeters = this.computeDistance(layerA, layerB);
        const closestPair = this._closestPair;
        if (!closestPair || distanceMeters === 0) return;

        const [cA, cB] = closestPair;

        // Use createDistanceFeature to ensure consistency
        const lineFeature = this.createDistanceFeature(new LineString([cA, cB]), 'line');

        const midpoint: [number, number] = [(cA[0] + cB[0]) / 2, (cA[1] + cB[1]) / 2];
        const formattedDistance = distanceMeters >= 1000
            ? `${(distanceMeters / 1000).toFixed(2)} km`
            : `${distanceMeters.toFixed(1)} m`;

        const labelFeature = this.createDistanceFeature(
            new Point(midpoint),
            'label',
            formattedDistance,
            lineFeature,
            true,
            true
        );

        this.tempSource.addFeature(lineFeature);
        this.tempSource.addFeature(labelFeature);

        const layerName = `dist: ${layerA.name || 'A'} ↔ ${layerB.name || 'B'}`;
        this.save(layerName);

        this.onConfirmComplete?.();
    }
}