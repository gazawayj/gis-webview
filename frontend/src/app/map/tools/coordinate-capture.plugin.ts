import Feature from 'ol/Feature';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Point } from 'ol/geom';
import { toLonLat } from 'ol/proj';
import { LayerManagerService } from '../services/layer-manager.service';
import { ToolPluginBase } from './tool-base.plugin';

export class CoordinateCapturePlugin extends ToolPluginBase {
  name = 'coordinate-capture';

  private hoverLayer?: VectorLayer<VectorSource>;
  private hoverFeature?: Feature;

  constructor(layerManager: LayerManagerService) {
    super(layerManager);
  }

  protected override onActivate(): void {
    if (!this.map || !this.tempSource) return;

    // ---------- Hover layer ----------
    const hoverSource = new VectorSource();
    this.hoverFeature = new Feature(new Point([0, 0]));
    this.hoverFeature.set('featureType', 'hover');
    hoverSource.addFeature(this.hoverFeature);

    this.hoverLayer = new VectorLayer({
      source: hoverSource,
      style: (f) => this.getFeatureStyle(f as Feature),
    });
    this.map.addLayer(this.hoverLayer);

    // ---------- Hover moves with pointer ----------
    this.registerMapListener('pointermove', (evt: any) => {
      this.hoverFeature?.setGeometry(new Point(evt.coordinate));
    });

    // ---------- Left click → capture point ----------
    this.registerMapListener('singleclick', (evt: any) => {
      if (evt.originalEvent?.button !== 0) return;
      const coord = evt.coordinate as [number, number];
      const shape = this.activeLayer?.shape || this.tempShape;
      const color = this.activeLayer?.color || this.tempColor;

      // Point
      const pointFeature = new Feature(new Point(coord));
      pointFeature.set('featureType', 'point');
      this.tempSource?.addFeature(pointFeature);

      // Label
      const [lon, lat] = toLonLat(coord);
      const labelFeature = new Feature(new Point(coord));
      labelFeature.set('featureType', 'label');
      labelFeature.set('text', `${lon.toFixed(4)}, ${lat.toFixed(4)}`);
      this.tempSource?.addFeature(labelFeature);

      // Apply immediate style
      pointFeature.setStyle(
        this.layerManager.styleService.getLayerStyle({
          type: 'point',
          shape,
          baseColor: color,
        })
      );
      labelFeature.setStyle(
        this.layerManager.styleService.getLayerStyle({
          type: 'label',
          shape,
          baseColor: color,
          text: labelFeature.get('text'),
        })
      );
    });

    // ---------- Right click → request save ----------
    this.registerDomListener(this.map.getViewport(), 'contextmenu', (evt: MouseEvent) => {
      evt.preventDefault();
      this.map
        ?.getTargetElement()
        .dispatchEvent(new CustomEvent('plugin-save-request', { bubbles: true }));
    });

    // ---------- ESC → cancel ----------
    this.registerDomListener(window, 'keydown', (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') this.cancel();
    });
  }

  protected override onDeactivate(): void {
    if (this.map && this.hoverLayer) this.map.removeLayer(this.hoverLayer);
    this.hoverLayer = undefined;
    this.hoverFeature = undefined;
  }

  protected override onSave(layer: any): void {
    // Mark for styling
    layer.isDistanceLayer = false;

    // Apply final style to all features in tempSource
    this.tempSource?.getFeatures().forEach((f) => {
      f.setStyle(this.getFeatureStyle(f));
    });
  }

  override getFeatures(): Feature[] {
    return this.tempSource?.getFeatures() ?? [];
  }
}
