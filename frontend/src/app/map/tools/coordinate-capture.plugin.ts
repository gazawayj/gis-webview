import Feature from 'ol/Feature';
import { Point } from 'ol/geom';
import { toLonLat } from 'ol/proj';
import { LayerManagerService } from '../services/layer-manager.service';
import { ToolPluginBase } from './tool-base.plugin';
import { LayerConfig } from '../models/layer-config.model';

export class CoordinateCapturePlugin extends ToolPluginBase {
  name = 'coordinate-capture';

  private hoverLayer?: LayerConfig;
  private hoverFeature?: Feature;

  constructor(layerManager: LayerManagerService) {
    super(layerManager);
  }

  protected override onActivate(): void {
    if (!this.map || !this.tempSource) return;

    // Create a temporary hover layer via LayerManager
    this.hoverLayer = this.layerManager.createLayer({
      planet: this.layerManager.currentPlanet,
      name: '__hover_temp__',
      isTemporary: true,
      features: [],
    });

    // Hover feature is a point type
    this.hoverFeature = this.createFeature(new Point([0, 0]), 'point');

    this.hoverLayer.olLayer.getSource()?.addFeature(this.hoverFeature);

    // Move hover point
    this.registerMapListener('pointermove', (evt: any) => {
      this.hoverFeature?.setGeometry(new Point(evt.coordinate));
    });

    // Left click — add point + label
    this.registerMapListener('singleclick', (evt: any) => {
      if (evt.originalEvent?.button !== 0) return;
      const coord = evt.coordinate as [number, number];

      const pointFeature = this.createFeature(new Point(coord), 'point');
      this.tempSource?.addFeature(pointFeature);

      const [lon, lat] = toLonLat(coord);
      const labelText = `${lon.toFixed(4)}, ${lat.toFixed(4)}`;

      const labelFeature = this.createFeature(new Point(coord), 'label', labelText, pointFeature, true);
      this.tempSource?.addFeature(labelFeature);
    });

    // ESC cancels tool
    this.registerDomListener(window, 'keydown', (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') this.cancel();
    });
  }

  protected override onDeactivate(): void {
    if (this.hoverLayer) {
      this.layerManager.remove(this.hoverLayer);
    }
    this.hoverLayer = undefined;
    this.hoverFeature = undefined;
  }
}