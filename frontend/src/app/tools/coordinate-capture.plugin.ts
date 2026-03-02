import Feature from 'ol/Feature';
import { Point } from 'ol/geom';
import { toLonLat } from 'ol/proj';
import { LayerManagerService } from '../map/services/layer-manager.service';
import { ToolPluginBase } from './tool-base.plugin';

export class CoordinateCapturePlugin extends ToolPluginBase {
  name = 'coordinate-capture';

  private hoverFeature?: Feature;

  constructor(layerManager: LayerManagerService) {
    super(layerManager);
  }

  protected override onActivate(): void {
    if (!this.map || !this.tempSource) return;

    // Create a temporary hover feature
    this.hoverFeature = this.createFeature(new Point([0, 0]), 'point', undefined, undefined, false);
    this.tempSource.addFeature(this.hoverFeature);

    // Update hover feature on pointer move
    this.registerMapListener('pointermove', (evt: any) => {
      this.hoverFeature?.setGeometry(new Point(evt.coordinate));
    });

    // On click, add point and persistent label
    this.registerMapListener('singleclick', (evt: any) => {
      if (evt.originalEvent?.button !== 0) return;
      const coord = evt.coordinate as [number, number];

      // Persistent point feature
      const pointFeature = this.createFeature(new Point(coord), 'point', undefined, undefined, true);
      if (this.activeLayer?.shape) pointFeature.set('shape', this.activeLayer.shape);
      this.tempSource?.addFeature(pointFeature);

      // Persistent label
      const [lon, lat] = toLonLat(coord);
      const labelText = `${lon.toFixed(4)}, ${lat.toFixed(4)}`;
      const labelFeature = this.createFeature(new Point(coord), 'label', labelText, pointFeature, false, true);
      if (this.activeLayer?.shape) labelFeature.set('shape', this.activeLayer.shape);
      this.tempSource?.addFeature(labelFeature);
    });

    // ESC cancels
    this.registerDomListener(window, 'keydown', (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') this.cancel();
    });
  }

  protected override onDeactivate(): void {
    this.hoverFeature = undefined;
  }
}