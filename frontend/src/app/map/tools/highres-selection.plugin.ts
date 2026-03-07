import Draw, { createBox } from 'ol/interaction/Draw';
import { Geometry, Polygon } from 'ol/geom';
import TileLayer from 'ol/layer/Tile';
import Feature from 'ol/Feature';
import { XYZ } from 'ol/source';
import TileGrid from 'ol/tilegrid/TileGrid';
import { ToolPluginBase } from './tool-base.plugin';
import { LayerManagerService } from '../services/layer-manager.service';
import VectorLayer from 'ol/layer/Vector';
import { LayerConfig } from '../models/layer-config.model';

export class HighResSelectionPlugin extends ToolPluginBase {
    name = 'highres-selection';

    private drawInteraction?: Draw;
    private selectionFeature?: Feature<Geometry>;
    private highResLayer?: TileLayer<XYZ>;

    private readonly HIGH_RES_URL =
        'https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX1/MapServer/tile/{z}/{y}/{x}';

    constructor(layerManager: LayerManagerService) {
        super(layerManager);
    }

    protected override onActivate(): void {
        if (!this.map || !this.tempSource) return;
        if (this.layerManager.currentPlanet !== 'mars') return;

        // Draw interaction using mouse drag (box)
        this.drawInteraction = new Draw({
            source: this.tempSource,
            type: 'Circle',
            geometryFunction: createBox(),
            // Disable double click finish
            freehand: false
        });
        this.registerInteraction(this.drawInteraction);

        this.drawInteraction.on('drawstart', (evt: any) => {
            this.selectionFeature = evt.feature as Feature<Geometry>;
            this.selectionFeature.set('featureType', 'polygon');
        });

        this.drawInteraction.on('drawend', () => {
            if (!this.selectionFeature || !this.map) return;

            const geom = this.selectionFeature.getGeometry() as Polygon;
            if (!geom) return;

            this.ensureHighResLayer();

            if (this.highResLayer) {
                this.highResLayer.setExtent(geom.getExtent());
                this.highResLayer.setVisible(true);

                // Wrap high-res TileLayer as a single tool feature
                const highResFeature = this.createFeature(
                    geom,
                    'polygon',
                    'High-Res Clip',
                    undefined,
                    true
                );

                // Attach the tile layer and a local high-res flag for z-order
                highResFeature.set('tileLayer', this.highResLayer);
                (highResFeature as any)._isHighRes = true;

                // Add to tempSource for save()
                this.tempSource?.addFeature(highResFeature);
            }

            this.selectionFeature = undefined;
        });

        this.registerDomListener(window, 'keydown', (evt: KeyboardEvent) => {
            if (evt.key === 'Escape') this.cancel();
        });
    }

    private ensureHighResLayer(): void {
        if (!this.map || this.highResLayer) return;

        const resolutions: number[] = [];
        const maxResolution = 180 / 256;
        for (let i = 0; i < 20; i++) resolutions.push(maxResolution / Math.pow(2, i));

        this.highResLayer = new TileLayer({
            source: new XYZ({
                url: this.HIGH_RES_URL,
                crossOrigin: 'anonymous',
                projection: 'EPSG:4326',
                tileGrid: new TileGrid({
                    origin: [-180, 90],
                    resolutions,
                    tileSize: [256, 256]
                }),
                wrapX: true
            }),
            visible: false,
            zIndex: 999
        });

        this.map.addLayer(this.highResLayer);
    }

    protected override onDeactivate(): void {
        if (this.drawInteraction) {
            this.drawInteraction.abortDrawing();
            this.drawInteraction.setActive(false);
            this.map?.removeInteraction(this.drawInteraction);
        }

        if (this.tempSource) {
            this.tempSource.clear();
        }

        if (this.highResLayer && this.map) {
            const savedLayer = (this as any)._justSavedLayer;
            if (this.highResLayer !== savedLayer) {
                this.map.removeLayer(this.highResLayer);
            }
        }
    }

    public override save(name: string): LayerConfig | null {
        if (!this.highResLayer || !this.activeLayer) return null;

        const features = this.getFeatures().filter(f => f.get('isToolFeature'));
        const tileFeature = features.find(f => f.get('tileLayer'));

        const geom = (tileFeature?.getGeometry() || this.selectionFeature?.getGeometry()) as Polygon;
        const extent = geom ? geom.getExtent() : undefined;

        const newLayer = this.layerManager.createLayer({
            planet: this.layerManager.currentPlanet,
            name: name,
            isTemporary: false,
            isTileLayer: true,
            olLayer: this.highResLayer,
            tileUrl: this.HIGH_RES_URL,
            tileExtent: extent,
            color: this.activeLayer.color,
            shape: 'none',
            cache: true
        });

        // Mark this layer so onDeactivate won't remove it
        (this as any)._justSavedLayer = this.highResLayer;

        // Attach local high-res flag for z-order
        (newLayer as any)._isHighRes = true;

        return newLayer;
    }
}