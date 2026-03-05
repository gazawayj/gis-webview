import Draw, { createBox } from 'ol/interaction/Draw';
import { Geometry, Polygon } from 'ol/geom';
import TileLayer from 'ol/layer/Tile';
import Feature from 'ol/Feature';
import { XYZ } from 'ol/source';
import TileGrid from 'ol/tilegrid/TileGrid';
import { get as getProjection } from 'ol/proj';
import { ToolPluginBase } from './tool-base.plugin';
import { LayerManagerService } from '../services/layer-manager.service';

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

        this.drawInteraction = new Draw({
            source: this.tempSource,
            type: 'Circle',
            geometryFunction: createBox()
        });

        this.registerInteraction(this.drawInteraction);

        this.drawInteraction.on('drawstart', (evt: any) => {
            this.selectionFeature = evt.feature as Feature;
            this.selectionFeature.set('featureType', 'polygon');
        });

        this.drawInteraction.on('drawend', () => {
            if (!this.selectionFeature) return;

            const geom = this.selectionFeature.getGeometry() as Polygon;
            if (!geom) return;

            const extent = geom.getExtent();
            this.ensureHighResLayer();

            if (this.highResLayer) {
                this.highResLayer.setExtent(extent);
                this.highResLayer.setVisible(true);
            }

            this.selectionFeature = undefined;
        });

        this.registerDomListener(window, 'keydown', (evt: KeyboardEvent) => {
            if (evt.key === 'Escape') this.cancel();
        });
    }

    private ensureHighResLayer(): void {
        if (!this.map || this.highResLayer) return;

        // Define resolutions for EPSG:4326 (Degrees per pixel)
        // Level 0 for a 180-degree normalized map usually covers 180 degrees in 1 tile (180/256 or 180/512)
        const resolutions = [];
        const maxResolution = 180 / 256;
        for (let i = 0; i < 20; i++) {
            resolutions.push(maxResolution / Math.pow(2, i));
        }

        this.highResLayer = new TileLayer({
            source: new XYZ({
                url: this.HIGH_RES_URL,
                crossOrigin: 'anonymous',
                projection: 'EPSG:4326',
                tileGrid: new TileGrid({
                    origin: [-180, 90],
                    resolutions: resolutions,
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
        if (this.tempSource) this.tempSource.clear();
        if (this.highResLayer && this.map) this.map.removeLayer(this.highResLayer);

        this.drawInteraction = undefined;
        this.selectionFeature = undefined;
        this.highResLayer = undefined;
    }
}
