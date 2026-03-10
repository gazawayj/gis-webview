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
 * Tool plugin for selecting a high-resolution Mars CTX imagery region.
 *
 * The tool allows the user to drag a rectangular selection box. The resulting
 * extent is used to clip a high-resolution CTX tile layer. The layer can then
 * be saved as a permanent map layer.
 *
 * Architecture notes:
 * - The tool only constructs the TileLayer instance.
 * - LayerManager is responsible for inserting layers into the map.
 * - Temporary geometry is stored in the tool's tempSource.
 */
export class HighResSelectionPlugin extends ToolPluginBase {

  /** Tool identifier used by ToolService */
  name = 'highres-selection';

  /** Draw interaction used for rectangular selection */
  private drawInteraction?: Draw;

  /** Current selection feature created by drawing */
  private selectionFeature?: Feature<Geometry>;

  /** High-resolution CTX imagery layer */
  private highResLayer?: TileLayer<XYZ>;

  /** URL template for Mars CTX imagery tiles */
  private readonly HIGH_RES_URL =
    'https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX1/MapServer/tile/{z}/{y}/{x}';

  /**
   * Creates the plugin instance.
   *
   * @param layerManager LayerManagerService used for layer creation and styling
   */
  constructor(layerManager: LayerManagerService) {
    super(layerManager);
  }

  /**
   * Activates the high-resolution selection tool.
   *
   * Initializes a Draw interaction configured to produce a rectangular
   * selection using the OpenLayers `createBox()` geometry function.
   *
   * When drawing completes:
   * - A CTX tile layer is prepared
   * - The tile layer is clipped to the selected extent
   * - A temporary feature referencing the tile layer is added
   */
  protected override onActivate(): void {

    if (!this.map || !this.tempSource) return;
    if (this.layerManager.currentPlanet !== 'mars') return;

    this.drawInteraction = new Draw({
      source: this.tempSource,
      type: 'Circle',
      geometryFunction: createBox(),
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

        const highResFeature = this.createFeature(
          geom,
          'polygon',
          'High-Res Clip',
          undefined,
          true
        );

        highResFeature.set('tileLayer', this.highResLayer);
        (highResFeature as any)._isHighRes = true;

        this.tempSource?.addFeature(highResFeature);
      }

      this.selectionFeature = undefined;
    });

    this.registerDomListener(window, 'keydown', (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') this.cancel();
    });
  }

  /**
   * Creates the CTX TileLayer used by the tool.
   *
   * The layer is intentionally **not added to the map here**. Layer insertion
   * is handled by LayerManager when the tool is saved.
   */
  private ensureHighResLayer(): void {

    if (this.highResLayer) return;

    const resolutions: number[] = [];
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
          resolutions,
          tileSize: [256, 256]
        }),
        wrapX: true
      }),
      visible: false,
      zIndex: 999
    });
  }

  /**
   * Deactivates the tool and cleans up temporary resources.
   *
   * Behavior:
   * - Aborts any active drawing operation
   * - Clears temporary features
   * - Removes the high-resolution layer if it was not saved
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
   * Saves the selected high-resolution region as a permanent map layer.
   *
   * The saved layer contains:
   * - The CTX tile source
   * - The clipped tile extent
   * - Styling information from the active tool layer
   *
   * @param name Name of the layer to create
   * @returns Newly created LayerConfig or null if unavailable
   */
  public override save(name: string): LayerConfig | null {

    if (!this.highResLayer || !this.activeLayer) return null;

    const features = this.getFeatures().filter(f => f.get('isToolFeature'));
    const tileFeature = features.find(f => f.get('tileLayer'));

    const geom = (tileFeature?.getGeometry() ||
      this.selectionFeature?.getGeometry()) as Polygon;

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

    (this as any)._justSavedLayer = this.highResLayer;
    (newLayer as any)._isHighRes = true;

    return newLayer;
  }
}