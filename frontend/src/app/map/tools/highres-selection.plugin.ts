import Draw, { createBox } from 'ol/interaction/Draw';
import Modify from 'ol/interaction/Modify';
import Translate from 'ol/interaction/Translate';
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
 * Allows drawing a rectangle and modifying its bounds (resizing and moving) 
 * before saving. The preview tiles stay clipped to the rectangle's extent.
 */
export class HighResSelectionPlugin extends ToolPluginBase {

  /** @type {string} Unique tool identifier */
  name = 'highres-selection';

  /** @private @type {Draw | undefined} Interaction for box creation */
  private drawInteraction?: Draw;

  /** @private @type {Modify | undefined} Interaction for resizing */
  private modifyInteraction?: Modify;

  /** @private @type {Translate | undefined} Interaction for moving the box */
  private translateInteraction?: Translate;

  /** @private @type {Feature<Geometry> | undefined} Current selection feature */
  private selectionFeature?: Feature<Geometry>;

  /** @private @type {TileLayer<XYZ> | undefined} High-resolution CTX imagery layer */
  private highResLayer?: TileLayer<XYZ>;

  /** @private @type {number} Track active tile requests for the loading spinner */
  private loadingTiles = 0;

  /** @private @readonly @type {string} Original URL template for Mars CTX tiles */
  private readonly HIGH_RES_URL = 'https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX1/MapServer/tile/{z}/{y}/{x}';

  /**
   * @param {LayerManagerService} layerManager Service for layer creation and UI state
   */
  constructor(layerManager: LayerManagerService) {
    super(layerManager);
  }

  /**
   * Activates the tool and prepares the Draw interaction.
   * @protected
   * @override
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
      this.tempSource?.clear();
      this.selectionFeature = evt.feature as Feature<Geometry>;
      this.selectionFeature.set('featureType', 'polygon');
    });

    this.drawInteraction.on('drawend', () => {
      if (!this.selectionFeature) return;

      const geom = this.selectionFeature.getGeometry() as Polygon;
      this.setupHighResPreview(geom);

      // Disable drawing to allow Modification/Translation
      this.drawInteraction?.setActive(false);
      this.enableEditing();
    });

    this.registerDomListener(window, 'keydown', (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') this.cancel();
    });
  }

  /**
   * Enables Resize (Modify) and Move (Translate) logic.
   * Updates the tile clipping extent in real-time as the user drags.
   * @private
   */
  private enableEditing(): void {
    if (!this.map || !this.tempSource) return;

    this.translateInteraction = new Translate({
      features: this.tempSource.getFeaturesCollection() || undefined
    });

    this.modifyInteraction = new Modify({
      source: this.tempSource,
      insertVertexCondition: () => false // Maintain rectangle nodes
    });

    // Enforce rectangular geometry logic
    (this.modifyInteraction as any).box_ = true;

    const syncExtent = () => {
      const feature = this.tempSource?.getFeatures().find(f => f.get('featureType') === 'polygon');
      if (feature && this.highResLayer) {
        const geom = feature.getGeometry() as Polygon;
        this.highResLayer.setExtent(geom.getExtent());
      }
    };

    // Update extent as the user finishes a drag operation
    this.modifyInteraction.on('modifyend', syncExtent);
    this.translateInteraction.on('translateend', syncExtent);

    this.registerInteraction(this.modifyInteraction);
    this.registerInteraction(this.translateInteraction);
  }

  /**
   * Clips the tile layer to the initial geometry and adds it to the map.
   * @param {Polygon} geom The polygon geometry to clip to.
   * @private
   */
  private setupHighResPreview(geom: Polygon): void {
    this.ensureHighResLayer();

    if (this.highResLayer) {
      this.highResLayer.setExtent(geom.getExtent());
      this.highResLayer.setVisible(true);

      const highResFeature = this.createFeature(geom, 'polygon', 'High-Res Clip', undefined, true);
      highResFeature.set('tileLayer', this.highResLayer);

      this.tempSource?.addFeature(highResFeature);

      // Add to map for preview if not already present
      if (!this.map?.getLayers().getArray().includes(this.highResLayer)) {
        this.map?.addLayer(this.highResLayer);
      }
    }
  }

  /**
   * Initializes the TileLayer with geographic TileGrid and loading card integration.
   * @private
   */
  private ensureHighResLayer(): void {
    if (this.highResLayer) return;

    const source = new XYZ({
      url: this.HIGH_RES_URL,
      crossOrigin: 'anonymous',
      projection: 'EPSG:4326',
      tileGrid: new TileGrid({
        origin: [-180, 90],
        resolutions: Array.from({ length: 20 }, (_, i) => (180 / 256) / Math.pow(2, i)),
        tileSize: [256, 256]
      }),
      wrapX: true
    });

    source.on('tileloadstart', () => {
      if (this.loadingTiles === 0) this.layerManager.startExternalLoad();
      this.loadingTiles++;
    });

    source.on(['tileloadend', 'tileloaderror'], () => {
      this.loadingTiles = Math.max(0, this.loadingTiles - 1);
      if (this.loadingTiles === 0) this.layerManager.endExternalLoad();
    });

    this.highResLayer = new TileLayer({
      source,
      visible: false,
      zIndex: 1000
    });
  }

  /**
   * Cleans up interactions and ensures the preview is removed if not saved.
   * @protected
   * @override
   */
  protected override onDeactivate(): void {
    [this.drawInteraction, this.modifyInteraction, this.translateInteraction].forEach(i => {
      if (i) this.map?.removeInteraction(i);
    });

    this.layerManager.endExternalLoad();
    this.loadingTiles = 0;

    if (this.tempSource) this.tempSource.clear();

    if (this.highResLayer && this.map) {
      const savedLayer = (this as any)._justSavedLayer;
      if (this.highResLayer !== savedLayer) {
        this.map.removeLayer(this.highResLayer);
      }
    }
  }

  /**
   * Finalizes the layer. Removes the preview layer from the map so the 
   * LayerManager can re-add it without duplicate collection errors.
   * @param {string} name Layer name
   * @override
   */
  public override save(name: string): LayerConfig | null {
    if (!this.highResLayer || !this.activeLayer || !this.map) return null;

    const feature = this.tempSource?.getFeatures().find(f => f.get('tileLayer'));
    const geom = feature?.getGeometry() as Polygon;

    // Remove from map so createLayer doesn't trigger "Duplicate item" error
    this.map.removeLayer(this.highResLayer);

    const newLayer = this.layerManager.createLayer({
      planet: this.layerManager.currentPlanet,
      name,
      isTemporary: false,
      isTileLayer: true,
      olLayer: this.highResLayer,
      tileUrl: this.HIGH_RES_URL,
      tileExtent: geom ? geom.getExtent() : undefined,
      color: this.activeLayer.color,
      shape: 'none',
      cache: true
    });

    (this as any)._justSavedLayer = this.highResLayer;
    return newLayer;
  }
}
