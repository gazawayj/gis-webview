// src/app/map/tools/distance-tool.plugin.ts
import { MapFacadeService, ToolPlugin } from '../services/map-facade.service';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Draw from 'ol/interaction/Draw';
import Feature, { FeatureLike } from 'ol/Feature';
import { LineString, Point } from 'ol/geom';
import { getLength } from 'ol/sphere';
import { PLANETS } from '../map-constants';
import { ShapeType } from '../services/symbol-constants';

export class DistanceToolPlugin implements ToolPlugin {
    name = 'distance';
    tempLayerConfig?: any;
    tempSource?: VectorSource;
    drawInteraction?: Draw;
    vertexLayer?: VectorLayer<VectorSource>;
    vertexSource?: VectorSource;
    currentFeature?: Feature;
    pointerMoveHandler?: (evt: any) => void;
    rightClickHandler?: (evt: MouseEvent) => void;

    color: string;
    shape: ShapeType | 'none';
    private mapFacade: MapFacadeService;
    private planet: 'earth' | 'moon' | 'mars';

    constructor(mapFacade: MapFacadeService) {
        this.mapFacade = mapFacade;
        this.planet = this.mapFacade['currentPlanet'];
        this.color = this.mapFacade['layerManager'].styleService.getRandomColor();
        this.shape = 'circle'; // default vertex shape
    }

    activate() {
        const map = this.mapFacade['map'];
        if (!map) return;

        this.tempSource = new VectorSource();

        const createdLayer = this.mapFacade['layerManager'].createLayer({
            planet: this.planet,
            name: 'Temp Distance',
            shape: 'line',
            color: this.color,
            cache: false,
            isTemporary: true,
            styleFn: f => this.getDrawStyle(f)
        });
        if (!createdLayer) return;

        this.tempLayerConfig = createdLayer;
        // Ensure vertex shape defaults to circle
        this.tempLayerConfig.shape = 'circle';

        this.drawInteraction = new Draw({
            source: this.tempSource,
            type: 'LineString',
            style: f => this.getDrawStyle(f)
        });
        map.addInteraction(this.drawInteraction);
        this.drawInteraction.on('drawstart', (evt: any) => (this.currentFeature = evt.feature));

        this.vertexSource = new VectorSource();
        this.vertexLayer = new VectorLayer({ source: this.vertexSource });
        map.addLayer(this.vertexLayer);

        this.pointerMoveHandler = evt => {
            this.vertexSource?.clear();
            if (this.currentFeature) {
                const coords = (this.currentFeature.getGeometry() as LineString).getCoordinates() as [number, number][];
                coords.forEach(c => this.addVertexFeature(c));
            }
            if (evt.coordinate) this.addVertexFeature(evt.coordinate as [number, number]);
        };
        map.on('pointermove', this.pointerMoveHandler);

        this.rightClickHandler = evt => {
            evt.preventDefault();
            if (this.currentFeature) this.drawInteraction?.finishDrawing();
            map.getTargetElement().dispatchEvent(new CustomEvent('plugin-save-request'));
        };
        map.getTargetElement().addEventListener('contextmenu', this.rightClickHandler);
    }

    private getDrawStyle(feature: FeatureLike) {
        const lm = this.mapFacade['layerManager'];
        const styles: any[] = [];
        if (!(feature instanceof Feature)) return styles;
        const geom = feature.getGeometry();
        if (!geom || geom.getType() !== 'LineString') return styles;

        const coords = (geom as LineString).getCoordinates() as [number, number][];

        // Line style
        styles.push(lm.styleService.getLayerStyle({
            type: 'line',
            baseColor: this.tempLayerConfig?.color
        }));

        // Vertices
        const shape: ShapeType | undefined = this.tempLayerConfig?.shape === 'none'
            ? undefined
            : this.tempLayerConfig?.shape;
        coords.forEach(coord => {
            styles.push(lm.styleService.getLayerStyle({
                type: 'point',
                baseColor: this.tempLayerConfig?.color,
                shape
            }));
        });

        return styles;
    }

    private addVertexFeature(coord: [number, number]) {
        if (!this.vertexSource || !this.tempLayerConfig) return;
        const shape: ShapeType | undefined = this.tempLayerConfig.shape === 'none'
            ? undefined
            : this.tempLayerConfig.shape;
        const vertex = new Feature(new Point(coord));
        vertex.setStyle(this.mapFacade['layerManager'].styleService.getLayerStyle({
            type: 'point',
            baseColor: this.tempLayerConfig.color,
            shape
        }));
        this.vertexSource.addFeature(vertex);
    }

    private buildStyledFeatures(feature: Feature): Feature[] {
        const lm = this.mapFacade['layerManager'];
        const featuresToSave: Feature[] = [];
        const cloned = feature.clone();
        featuresToSave.push(cloned);

        const geom = cloned.getGeometry() as LineString;
        const coords = geom.getCoordinates() as [number, number][];
        const lineColor = cloned.get('color') || this.tempLayerConfig?.color || '#000';
        const shape: ShapeType | undefined = this.tempLayerConfig?.shape === 'none'
            ? undefined
            : this.tempLayerConfig?.shape;

        coords.forEach(coord => {
            const vertex = new Feature(new Point(coord));
            vertex.setStyle(lm.styleService.getLayerStyle({
                type: 'point',
                baseColor: lineColor,
                shape
            }));
            featuresToSave.push(vertex);
        });

        for (let i = 1; i < coords.length; i++) {
            const [c1, c2] = [coords[i - 1], coords[i]];
            const midpoint: [number, number] = [(c1[0] + c2[0]) / 2, (c1[1] + c2[1]) / 2];
            const distanceMeters = getLength(new LineString([c1, c2]), { radius: PLANETS[this.planet].radius });
            const distanceText = distanceMeters >= 1000
                ? `${(distanceMeters / 1000).toFixed(2)} km`
                : `${distanceMeters.toFixed(1)} m`;
            const textFeature = new Feature(new Point(midpoint));
            textFeature.setStyle(lm.styleService.getLayerStyle({
                type: 'label',
                baseColor: lineColor,
                text: distanceText
            }));
            featuresToSave.push(textFeature);
        }

        return featuresToSave;
    }

    save(name: string) {
        if (!this.tempSource?.getFeatures().length || !this.tempLayerConfig) return;

        const allFeatures: Feature[] = [];
        this.tempSource.getFeatures().forEach(f => allFeatures.push(...this.buildStyledFeatures(f)));

        const savedLayer = this.mapFacade['layerManager'].addDistanceLayer(
            this.planet,
            name,
            allFeatures,
            this.tempLayerConfig.color,
            this.tempLayerConfig.styleFn
        );

        // Mark as distance layer and store vertex shape
        if (savedLayer) {
            savedLayer.isDistanceLayer = true;
            savedLayer.shape = this.tempLayerConfig.shape ?? 'circle';
        }

        this.cancel();
    }

    cancel() {
        const map = this.mapFacade['map'];
        if (this.tempLayerConfig) this.mapFacade['layerManager'].remove(this.tempLayerConfig);
        if (this.drawInteraction) map.removeInteraction(this.drawInteraction);
        if (this.vertexLayer) map.removeLayer(this.vertexLayer);
        if (this.pointerMoveHandler) map.un('pointermove', this.pointerMoveHandler);
        if (this.rightClickHandler) map.getTargetElement().removeEventListener('contextmenu', this.rightClickHandler);

        this.drawInteraction = undefined;
        this.vertexLayer = undefined;
        this.vertexSource = undefined;
        this.pointerMoveHandler = undefined;
        this.rightClickHandler = undefined;
        this.currentFeature = undefined;
        this.tempLayerConfig = undefined;
        this.tempSource = undefined;
    }
}