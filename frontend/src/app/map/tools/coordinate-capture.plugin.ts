import Feature from 'ol/Feature';
import { Point } from 'ol/geom';
import { toLonLat } from 'ol/proj';
import { LayerManagerService } from '../services/layer-manager.service';
import { ToolPluginBase } from './tool-base.plugin';

/**
 * Tool plugin for capturing a single coordinate on the map.
 * Displays a live hover vertex and allows clicking to place a point with a coordinate label.
 */
export class CoordinateCapturePlugin extends ToolPluginBase {
  /** Tool type identifier */
  name = 'coordinate-capture';

  /** Feature used for hover visualization (not saved) */
  private hoverFeature?: Feature;
  /** Currently selected point feature */
  private currentPoint?: Feature;
  /** Currently displayed label feature for the point */
  private currentLabel?: Feature;

  constructor(layerManager: LayerManagerService) {
    super(layerManager);
  }

  /** Activates tool: sets up hover and click interactions */
  protected override onActivate(): void {
    if (!this.map || !this.tempSource) return;

    // Hover vertex: purely UI
    this.hoverFeature = this.createFeature(
      new Point([]),
      'pointerVertex',
      undefined,
      undefined,
      false
    );
    this.tempSource.addFeature(this.hoverFeature);

    // Update hover position on pointer move
    this.registerMapListener('pointermove', (evt: any) => {
      const geom = this.hoverFeature?.getGeometry() as Point;
      if (geom) geom.setCoordinates(evt.coordinate);
    });

    // Place point and label on single left click
    this.registerMapListener('singleclick', (evt: any) => {
      if (!this.tempSource) return;

      // Remove previous features
      if (this.currentPoint) this.tempSource.removeFeature(this.currentPoint);
      if (this.currentLabel) this.tempSource.removeFeature(this.currentLabel);

      const coord = evt.coordinate;
      const [lon, lat] = toLonLat(coord);
      const labelText = `${lon.toFixed(4)}, ${lat.toFixed(4)}`;

      // Create new features using base styling pipeline
      this.currentPoint = this.createFeature(new Point(coord), 'point', undefined, undefined, true);
      this.currentLabel = this.createFeature(new Point(coord), 'label', labelText, this.currentPoint, true);

      this.tempSource.addFeatures([this.currentPoint, this.currentLabel]);
    });

    // Prevent default context menu
    this.registerDomListener(this.map.getViewport(), 'contextmenu', (evt: MouseEvent) => evt.preventDefault());

    // Escape cancels the tool
    this.registerDomListener(window, 'keydown', (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') this.cancel();
    });
  }

  /**
   * Saves the captured coordinate to a permanent layer.
   * Removes hover feature before saving.
   * @param name Name of the new layer
   * @returns Newly created layer or null
   */
  public override save(name: string): any {
    // Remove hover before saving
    if (this.hoverFeature && this.tempSource) {
      this.tempSource.removeFeature(this.hoverFeature);
      this.hoverFeature = undefined;
    }

    const newLayer = super.save(name);
    if (newLayer) this.deactivate();
    return newLayer;
  }

  /** Deactivates the tool and clears features */
  protected override onDeactivate(): void {
    if (this.hoverFeature && this.tempSource) this.tempSource.removeFeature(this.hoverFeature);
    this.hoverFeature = undefined;
    this.currentPoint = undefined;
    this.currentLabel = undefined;
  }
}