import Feature from 'ol/Feature';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Point } from 'ol/geom';
import { toLonLat } from 'ol/proj';
import { LayerManagerService } from '../services/layer-manager.service';
import { ToolPluginBase } from './tool-base.plugin';

export class CoordinateCapturePlugin extends ToolPluginBase {
  name = 'coordinate-capture';

  private hoverLayer?: VectorLayer<VectorSource<Feature>>;
  private hoverFeature?: Feature;

  constructor(layerManager: LayerManagerService) {
    super(layerManager);
  }

  protected override onActivate(): void {
    if (!this.map || !this.tempSource) return;

    // Hover indicator
    const hoverSource = new VectorSource();
    this.hoverFeature = this.createStyledFeature(new Point([0, 0]), 'point');
    this.hoverFeature.set('featureType', 'hover');
    hoverSource.addFeature(this.hoverFeature);

    this.hoverLayer = new VectorLayer({
      source: hoverSource,
      style: (f) => this.getFeatureStyle(f as Feature),
    });

    this.map.addLayer(this.hoverLayer);

    // Move hover point
    this.registerMapListener('pointermove', (evt: any) => {
      this.hoverFeature?.setGeometry(new Point(evt.coordinate));
    });

    // Left click — add point + label
    this.registerMapListener('singleclick', (evt: any) => {
      if (evt.originalEvent?.button !== 0) return;

      const coord = evt.coordinate as [number, number];

      const pointFeature = this.createStyledFeature(new Point(coord), 'point');
      this.tempSource?.addFeature(pointFeature);

      const [lon, lat] = toLonLat(coord);
      const labelText = `${lon.toFixed(4)}, ${lat.toFixed(4)}`;

      const labelFeature = this.createStyledFeature(
        new Point(coord),
        'label',
        labelText,
        pointFeature,
        true
      );

      this.tempSource?.addFeature(labelFeature);
    });

    // ESC cancels tool
    this.registerDomListener(window, 'keydown', (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') this.cancel();
    });
  }

  protected override onDeactivate(): void {
    if (this.map && this.hoverLayer) this.map.removeLayer(this.hoverLayer);
    this.hoverLayer = undefined;
    this.hoverFeature = undefined;
  }
}