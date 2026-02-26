// frontend/src/app/map/tools/coordinate-capture.plugin.ts
import Feature from 'ol/Feature';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Point } from 'ol/geom';
import { toLonLat } from 'ol/proj';
import { LayerManagerService } from '../services/layer-manager.service';
import { ToolPluginBase } from './tool-base.plugin';
import Style from 'ol/style/Style';
import Text from 'ol/style/Text';
import Fill from 'ol/style/Fill';

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

      // Coordinate label
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

  /**
   * Called when the save modal triggers saving the layer
   * `layer.title` is the name from the modal (user-entered or default)
   */
  protected override onSave(layer: any): void {
    layer.isDistanceLayer = true;

    const features = this.tempSource?.getFeatures() ?? [];

    // Style existing features
    features.forEach((f) => f.setStyle(this.getFeatureStyle(f)));

    // Add layer-name label for each point into the same source that will persist
    if (layer.title) {
      features.forEach((f) => {
        if (f.get('featureType') === 'point') {
          const coord = (f.getGeometry() as Point).getCoordinates();

          // Create label feature slightly below the point
          const nameLabel = new Feature(new Point([coord[0], coord[1]]));
          nameLabel.set('featureType', 'label');
          nameLabel.set('text', layer.title);

          // Use a dedicated OpenLayers Style for the layer name label
          const style = new Style({
            text: new Text({
              text: layer.title,
              fill: new Fill({ color: '#000' }),
              font: 'bold 12px Arial',
              offsetY: 20, // 20 pixels below the point
              textAlign: 'center',
            }),
          });

          nameLabel.setStyle(style);

          // Add the label directly to the layer’s vector source (not tempSource)
          if (layer.getSource) {
            layer.getSource().addFeature(nameLabel);
          } else {
            // fallback if layer is plain object
            this.tempSource?.addFeature(nameLabel);
          }
        }
      });
    }
  }

  override getFeatures(): Feature[] {
    return this.tempSource?.getFeatures() ?? [];
  }
}