import Draw, { createBox } from 'ol/interaction/Draw';
import { Geometry, Polygon } from 'ol/geom';
import TileLayer from 'ol/layer/Tile';
import Feature from 'ol/Feature';
import { XYZ } from 'ol/source';
import TileGrid from 'ol/tilegrid/TileGrid';
import { ToolPluginBase } from './tool-base.plugin';
import { LayerManagerService } from '../services/layer-manager.service';
import { LayerConfig } from '../models/layer-config.model';

/**
 * Tool plugin for selecting a high-resolution tile area on Mars.
 * Allows the user to draw a rectangle and automatically adds
 * a high-resolution tile layer clipped to the selected extent.
 */
export class HighResSelectionPlugin extends ToolPluginBase {
    /** Tool type identifier */
    name = 'highres-selection';

    /** Draw interaction for creating a selection rectangle */
    private drawInteraction?: Draw;

    /** Current selection feature being drawn */
    private selectionFeature?: Feature<Geometry>;

    /** TileLayer for displaying the high-resolution imagery */
    private highResLayer?: TileLayer<XYZ>;

    /** URL template for the Mars CTX high-resolution tiles */
    private readonly HIGH_RES_URL =
        'https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX1/MapServer/tile/{z}/{y}/{x}';

    constructor(layerManager: LayerManagerService) {
        super(layerManager);
    }

    /**
     * Activates the high-res selection tool.
     * Sets up box drawing interaction and handles drawing events.
     */
    protected override onActivate(): void {
        if (!this.map || !this.tempSource) return;
        if (this.layerManager.currentPlanet !== 'mars') return;

        // Draw interaction using mouse drag (box)
        this.drawInteraction = new Draw({
            source: this.tempSource,
            type: 'Circle',
            // convert circle to box, createBox() is a helper that takes a "circle" type input and converts it into a rectangle.
            geometryFunction: createBox(),
            // Disable double click finish
            freehand: false
        });
        this.registerInteraction(this.drawInteraction);

        // Start drawing
        this.drawInteraction.on('drawstart', (evt: any) => {
            this.selectionFeature = evt.feature as Feature<Geometry>;
            this.selectionFeature.set('featureType', 'polygon');
        });

        // Finish drawing
        this.drawInteraction.on('drawend', () => {
            if (!this.selectionFeature || !this.map) return;
            const geom = this.selectionFeature.getGeometry() as Polygon;
            if (!geom) return;
            this.ensureHighResLayer();

            // Clip high-res layer to selected extent
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

        // Cancel drawing on Escape
        this.registerDomListener(window, 'keydown', (evt: KeyboardEvent) => {
            if (evt.key === 'Escape') this.cancel();
        });
    }

    /**
     * Ensures the high-resolution TileLayer is created and added to the map.
     * Only creates it once.
     */
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

    /**
     * Deactivates the tool: aborts drawing, clears temp features,
     * and removes the high-res layer if it wasn’t saved.
     */
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

    /**
     * Saves the high-res selection as a permanent layer.
     * @param name Name of the new layer
     * @returns LayerConfig of the new high-res layer or null if unavailable
     */
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