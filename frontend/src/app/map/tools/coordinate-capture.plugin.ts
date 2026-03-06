import Feature from 'ol/Feature';
import { Point } from 'ol/geom';
import { toLonLat } from 'ol/proj';
import { LayerManagerService } from '../services/layer-manager.service';
import { ToolPluginBase } from './tool-base.plugin';

export class CoordinateCapturePlugin extends ToolPluginBase {
  name = 'coordinate-capture';

  private hoverFeature?: Feature;
  private currentPoint?: Feature;
  private currentLabel?: Feature;

  constructor(layerManager: LayerManagerService) {
    super(layerManager);
  }

  protected override onActivate(): void {
    if (!this.map || !this.tempSource) return;

    // Hover vertex: purely UI, not saved
    this.hoverFeature = this.createFeature(
      new Point([]),
      'pointerVertex',
      undefined,
      undefined,
      false
    );
    this.tempSource.addFeature(this.hoverFeature);

    this.registerMapListener('pointermove', (evt: any) => {
      const geom = this.hoverFeature?.getGeometry() as Point;
      if (geom) geom.setCoordinates(evt.coordinate);
    });

    // Left click: replace single point & label
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

    this.registerDomListener(this.map.getViewport(), 'contextmenu', (evt: MouseEvent) => evt.preventDefault());
    this.registerDomListener(window, 'keydown', (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') this.cancel();
    });
  }

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

  protected override onDeactivate(): void {
    if (this.hoverFeature && this.tempSource) this.tempSource.removeFeature(this.hoverFeature);
    this.hoverFeature = undefined;
    this.currentPoint = undefined;
    this.currentLabel = undefined;
  }
}