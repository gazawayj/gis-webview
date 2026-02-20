import { Injectable, NgZone } from '@angular/core';
import Map from 'ol/Map';
import View from 'ol/View';
import { toLonLat } from 'ol/proj';
import { ToolType } from './tool.service';
import { LayerManagerService, LayerConfig } from './layer-manager.service';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Draw from 'ol/interaction/Draw';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import Feature from 'ol/Feature';
import type { FeatureLike } from 'ol/Feature';
import { Style, Stroke, Circle as CircleStyle, Fill } from 'ol/style';

@Injectable({ providedIn: 'root' })
export class MapFacadeService {
  map!: Map;
  private currentPlanet: 'earth' | 'moon' | 'mars' = 'earth';

  private tempLayerConfig?: LayerConfig;
  private drawInteraction?: Draw;
  private tempSource?: VectorSource;
  private vertexSource?: VectorSource;
  private vertexLayer?: VectorLayer<VectorSource>;
  private currentFeature?: Feature;

  private pointerMoveHandler?: (evt: any) => void;
  private rightClickHandler?: (evt: MouseEvent) => void;

  private tempPlanet?: 'earth' | 'moon' | 'mars';

  constructor(private zone: NgZone, private layerManager: LayerManagerService) {}

  // ================= INIT =================
  public initMap(container: HTMLElement, planet: 'earth' | 'moon' | 'mars') {
    this.currentPlanet = planet;

    const view = new View({ center: [0, 0], zoom: 2 });

    this.map = new Map({
      target: container,
      layers: [],
      view
    });

    this.layerManager.attachMap(this.map);
    this.layerManager.loadPlanet(this.currentPlanet);
  }

  // ================= POINTER TRACKING (RESTORED) =================
  public trackPointer(callback: (lon: number, lat: number, zoom: number) => void) {
    if (!this.map) return;

    const view = this.map.getView();

    this.map.on('pointermove', (evt: any) => {
      const coord = evt.coordinate;
      if (!coord) return;

      this.zone.run(() => {
        const [lon, lat] = toLonLat(coord);
        callback(+lon.toFixed(6), +lat.toFixed(6), +(view.getZoom() ?? 2));
      });
    });
  }

  // ================= PLANET =================
  public setPlanet(planet: 'earth' | 'moon' | 'mars') {
    if (!this.map || planet === this.currentPlanet) return;

    this.cancelDistanceLayer();

    this.currentPlanet = planet;
    this.layerManager.loadPlanet(planet);

    const view = this.map.getView();
    view.setCenter([0, 0]);
    view.setZoom(2);
  }

  // ================= TOOL =================
  public activateTool(tool?: ToolType) {
    this.cancelDistanceLayer();
    if (tool === 'distance') this.enableDistanceTool();
  }

  // ================= SAVE DISTANCE =================
  public saveDistanceLayer(name: string) {
    if (!this.tempSource || !this.tempSource.getFeatures().length) return;

    const features = this.tempSource.getFeatures().map(f => f.clone());
    const planet = this.tempPlanet ?? this.currentPlanet;

    this.layerManager.addDistanceLayer(planet, name, features);

    this.cancelDistanceLayer();
  }

  public cancelDistanceLayer() {
    if (this.tempLayerConfig) this.layerManager.remove(this.tempLayerConfig);
    this.resetTools();
  }

  // ================= DISTANCE TOOL =================
  private enableDistanceTool() {
    const color = this.layerManager.styleService.getRandomColor();
    this.tempPlanet = this.currentPlanet;

    this.tempSource = new VectorSource();

    this.tempLayerConfig = this.layerManager.createLayer({
      planet: this.currentPlanet,
      name: 'Temp Distance',
      shape: 'line',
      color,
      cache: false,
      isTemporary: true
    })!;

    this.drawInteraction = new Draw({
      source: this.tempSource,
      type: 'LineString',
      style: f => this.getDistanceStyle(f, color)
    });

    this.map.addInteraction(this.drawInteraction);

    this.drawInteraction.on('drawstart', (evt: any) => {
      this.currentFeature = evt.feature;
    });

    this.vertexSource = new VectorSource();
    this.vertexLayer = new VectorLayer({ source: this.vertexSource });
    this.map.addLayer(this.vertexLayer);

    this.pointerMoveHandler = evt => {
      this.vertexSource?.clear();

      if (this.currentFeature) {
        const geom = this.currentFeature.getGeometry() as LineString;
        geom.getCoordinates().forEach(c => {
          this.vertexSource?.addFeature(new Feature(new Point(c)));
        });
      }

      const pointerCoord = evt.coordinate;
      if (pointerCoord) {
        this.vertexSource?.addFeature(new Feature(new Point(pointerCoord)));
      }
    };

    this.map.on('pointermove', this.pointerMoveHandler);

    this.rightClickHandler = evt => {
      evt.preventDefault();
      if (this.currentFeature) this.drawInteraction?.finishDrawing();

      this.map.getTargetElement().dispatchEvent(
        new CustomEvent('distance-save-request')
      );
    };

    this.map
      .getTargetElement()
      .addEventListener('contextmenu', this.rightClickHandler);
  }

  private resetTools() {
    if (this.drawInteraction) this.map.removeInteraction(this.drawInteraction);
    if (this.vertexLayer) this.map.removeLayer(this.vertexLayer);

    if (this.pointerMoveHandler) this.map.un('pointermove', this.pointerMoveHandler);
    if (this.rightClickHandler) {
      this.map.getTargetElement().removeEventListener('contextmenu', this.rightClickHandler);
    }

    this.drawInteraction = undefined;
    this.vertexLayer = undefined;
    this.vertexSource = undefined;
    this.pointerMoveHandler = undefined;
    this.rightClickHandler = undefined;
    this.currentFeature = undefined;
    this.tempLayerConfig = undefined;
  }

  private getDistanceStyle(feature: FeatureLike, color: string) {
    return [
      new Style({
        stroke: new Stroke({ color, width: 3 }),
        image: new CircleStyle({
          radius: 5,
          fill: new Fill({ color }),
          stroke: new Stroke({ color: '#000', width: 1 })
        })
      })
    ];
  }
}