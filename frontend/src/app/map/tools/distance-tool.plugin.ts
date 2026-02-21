// frontend/src/app/map/tools/distance-tool.plugin.ts
import { MapFacadeService, ToolPlugin } from '../services/map-facade.service';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Draw from 'ol/interaction/Draw';
import Feature, { FeatureLike } from 'ol/Feature';
import { LineString, Point } from 'ol/geom';
import { getLength } from 'ol/sphere';
import { PLANETS } from '../map-constants';
import { SHAPES, ShapeType } from '../services/symbol-constants';
import { Style } from 'ol/style';

export class DistanceToolPlugin implements ToolPlugin {
    name = 'distance';
    tempSource?: VectorSource;
    drawInteraction?: Draw;
    vertexLayer?: VectorLayer<VectorSource>;
    vertexSource?: VectorSource;
    currentFeature?: Feature;
    pointerMoveHandler?: (evt: any) => void;
    rightClickHandler?: (evt: MouseEvent) => void;

    color: string;
    shape: ShapeType;
    private mapFacade: MapFacadeService;
    private planet: 'earth' | 'moon' | 'mars';
    private tempLayer?: VectorLayer<VectorSource>;

    constructor(mapFacade: MapFacadeService) {
        this.mapFacade = mapFacade;
        this.planet = this.mapFacade['currentPlanet'];
        this.color = this.mapFacade['layerManager'].styleService.getRandomColor();

        // ===== FIX: enforce valid shape =====
        const randomShape = this.mapFacade['layerManager'].styleService.getRandomShape();
        this.shape = (randomShape && SHAPES.includes(randomShape) && randomShape !== 'line')
            ? randomShape
            : 'circle';
    }

    activate() {
        const map = this.mapFacade['map'];
        if (!map) return;

        // Temporary source for line + vertices + labels
        this.tempSource = new VectorSource();

        // Temporary layer rendering tempSource
        this.tempLayer = new VectorLayer({ source: this.tempSource, style: f => this.getDrawStyle(f) });
        map.addLayer(this.tempLayer);

        // Draw interaction
        this.drawInteraction = new Draw({
            source: this.tempSource,
            type: 'LineString',
            style: f => this.getDrawStyle(f)
        });
        map.addInteraction(this.drawInteraction);
        this.drawInteraction.on('drawstart', (evt: any) => (this.currentFeature = evt.feature));

        // Vertex layer for live points
        this.vertexSource = new VectorSource();
        this.vertexLayer = new VectorLayer({ source: this.vertexSource });
        map.addLayer(this.vertexLayer);

        // Pointer move updates vertices + labels
        this.pointerMoveHandler = evt => {
            this.vertexSource?.clear();
            if (this.currentFeature) {
                const coords = (this.currentFeature.getGeometry() as LineString).getCoordinates() as [number, number][];
                coords.forEach(c => this.addVertexFeature(c));
                this.updateDistanceLabels(coords);
            }
            if (evt.coordinate) this.addVertexFeature(evt.coordinate as [number, number]);
        };
        map.on('pointermove', this.pointerMoveHandler);

        // Right-click finishes drawing
        this.rightClickHandler = evt => {
            evt.preventDefault();
            if (this.currentFeature) this.drawInteraction?.finishDrawing();
            map.getTargetElement().dispatchEvent(new CustomEvent('plugin-save-request'));
        };
        map.getTargetElement().addEventListener('contextmenu', this.rightClickHandler);
    }

    // ================= STYLE HANDLING =================
    private getDrawStyle(feature: FeatureLike): Style[] {
        if (!(feature instanceof Feature)) return [];
        const lm = this.mapFacade['layerManager'];

        if (feature.get('isDistanceLabel') || feature.get('text')) {
            const s = feature.getStyle();
            if (Array.isArray(s)) return s as Style[];
            if (s instanceof Style) return [s];
            return [];
        }

        const geom = feature.getGeometry();
        if (!geom) return [];

        const styles: Style[] = [];
        if (geom.getType() === 'LineString') {
            styles.push(lm.styleService.getLayerStyle({ type: 'line', baseColor: this.color }));
            const coords = (geom as LineString).getCoordinates() as [number, number][];
            coords.forEach(coord => {
                styles.push(lm.styleService.getLayerStyle({
                    type: 'point',
                    baseColor: this.color,
                    shape: this.shape
                }));
            });
        }
        return styles;
    }

    private addVertexFeature(coord: [number, number]) {
        if (!this.vertexSource) return;
        const vertex = new Feature(new Point(coord));
        vertex.setStyle(this.mapFacade['layerManager'].styleService.getLayerStyle({
            type: 'point',
            baseColor: this.color,
            shape: this.shape
        }));
        this.vertexSource.addFeature(vertex);
    }

    // ================= DISTANCE LABELS =================
    private updateDistanceLabels(coords: [number, number][]) {
        if (!this.tempSource || coords.length < 2) return;

        const oldLabels = this.tempSource.getFeatures().filter(f => f.get('isDistanceLabel'));
        oldLabels.forEach(f => this.tempSource?.removeFeature(f));

        const lm = this.mapFacade['layerManager'];

        for (let i = 1; i < coords.length; i++) {
            const [c1, c2] = [coords[i - 1], coords[i]];
            const midpoint: [number, number] = [(c1[0] + c2[0]) / 2, (c1[1] + c2[1]) / 2];
            const distanceMeters = getLength(new LineString([c1, c2]), { radius: PLANETS[this.planet].radius });
            const distanceText = distanceMeters >= 1000
                ? `${(distanceMeters / 1000).toFixed(2)} km`
                : `${distanceMeters.toFixed(1)} m`;

            const labelFeature = new Feature(new Point(midpoint));
            labelFeature.set('isDistanceLabel', true);
            labelFeature.set('text', distanceText);
            labelFeature.setStyle(lm.styleService.getLayerStyle({ type: 'label', baseColor: this.color, text: distanceText }));

            this.tempSource.addFeature(labelFeature);
        }
    }

    // ================= SAVING =================
    private buildStyledFeatures(feature: Feature): Feature[] {
        const lm = this.mapFacade['layerManager'];
        const featuresToSave: Feature[] = [];
        const cloned = feature.clone();
        featuresToSave.push(cloned);

        const geom = cloned.getGeometry() as LineString;
        const coords = geom.getCoordinates() as [number, number][];

        // Vertices
        coords.forEach(coord => {
            const vertex = new Feature(new Point(coord));
            vertex.setStyle(lm.styleService.getLayerStyle({
                type: 'point',
                baseColor: this.color,   // <--- ensure color is applied here
                shape: this.shape
            }));
            featuresToSave.push(vertex);
        });

        // Distance labels
        for (let i = 1; i < coords.length; i++) {
            const [c1, c2] = [coords[i - 1], coords[i]];
            const midpoint: [number, number] = [(c1[0] + c2[0]) / 2, (c1[1] + c2[1]) / 2];
            const distanceMeters = getLength(new LineString([c1, c2]), { radius: PLANETS[this.planet].radius });
            const distanceText = distanceMeters >= 1000
                ? `${(distanceMeters / 1000).toFixed(2)} km`
                : `${distanceMeters.toFixed(1)} m`;

            // Add the line feature with explicit color
            const lineFeature = new Feature(new LineString([c1, c2]));
            lineFeature.setStyle(lm.styleService.getLayerStyle({
                type: 'line',
                baseColor: this.color  // <--- this fixes the invisible lines
            }));
            featuresToSave.push(lineFeature);

            const textFeature = new Feature(new Point(midpoint));
            textFeature.set('isDistanceLabel', true);
            textFeature.set('text', distanceText);
            textFeature.setStyle(lm.styleService.getLayerStyle({
                type: 'label',
                baseColor: this.color,
                text: distanceText
            }));
            featuresToSave.push(textFeature);
        }

        return featuresToSave;
    }

    save(name: string) {
        if (!this.tempSource?.getFeatures().length || !this.tempLayer) return;

        // Remove temporary labels
        this.tempSource.getFeatures()
            .filter(f => f.get('isDistanceLabel'))
            .forEach(f => this.tempSource?.removeFeature(f));

        // Build all features
        const allFeatures: Feature[] = [];
        this.tempSource.getFeatures().forEach(f => allFeatures.push(...this.buildStyledFeatures(f)));

        // Remove temp layers/interactions
        this.cancel();

        // ===== FIX: enforce valid shape when saving =====
        const validShape = (this.shape && SHAPES.includes(this.shape) && this.shape !== 'line') ? this.shape : 'circle';

        const savedLayer = this.mapFacade['layerManager'].addLayer(this.planet, name, allFeatures, this.color);
        if (savedLayer) {
            savedLayer.isDistanceLayer = true;
            savedLayer.shape = validShape;
        }
    }

    cancel() {
        const map = this.mapFacade['map'];
        if (this.tempLayer) map.removeLayer(this.tempLayer);
        if (this.drawInteraction) map.removeInteraction(this.drawInteraction);
        if (this.vertexLayer) map.removeLayer(this.vertexLayer);
        if (this.pointerMoveHandler) map.un('pointermove', this.pointerMoveHandler);
        if (this.rightClickHandler) map.getTargetElement().removeEventListener('contextmenu', this.rightClickHandler);

        this.drawInteraction = undefined;
        this.tempLayer = undefined;
        this.vertexLayer = undefined;
        this.vertexSource = undefined;
        this.pointerMoveHandler = undefined;
        this.rightClickHandler = undefined;
        this.currentFeature = undefined;
        this.tempSource = undefined;
    }
}