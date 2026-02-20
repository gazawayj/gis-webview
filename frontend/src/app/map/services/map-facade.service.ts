import { Injectable, NgZone } from '@angular/core';
import Map from 'ol/Map';
import View from 'ol/View';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Draw from 'ol/interaction/Draw';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import Feature from 'ol/Feature';
import type { FeatureLike } from 'ol/Feature';
import { ToolType } from './tool.service';
import { LayerManagerService } from './layer-manager.service';
import Style from 'ol/style/Style';
import Stroke from 'ol/style/Stroke';
import CircleStyle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import { toLonLat } from 'ol/proj';

@Injectable({ providedIn: 'root' })
export class MapFacadeService {
  map!: Map;
  private currentPlanet: 'earth' | 'moon' | 'mars' = 'earth';
  private measurementPlanet?: 'earth' | 'moon' | 'mars';
  private drawInteraction?: Draw;
  private measureSource?: VectorSource;
  private measureLayer?: VectorLayer<VectorSource>;
  private vertexSource?: VectorSource;
  private vertexLayer?: VectorLayer<VectorSource>;
  private clearDistanceTool?: () => void;
  private sessionColor?: string;

  constructor(private zone: NgZone, private layerManager: LayerManagerService) { }

  // ================= PUBLIC API =================
  public initMap(container: HTMLElement, planet: 'earth' | 'moon' | 'mars') {
    this.currentPlanet = planet;

    const view = new View({ center: [0, 0], zoom: 2 });
    this.map = new Map({ target: container, layers: [], view });

    this.layerManager.attachMap(this.map);
    this.layerManager.loadPlanet(this.currentPlanet);
  }

  public setPlanet(planet: 'earth' | 'moon' | 'mars') {
    if (!this.map || planet === this.currentPlanet) return;

    // Remove any temporary distance tools before switching planets
    this.resetTools();

    this.currentPlanet = planet;
    this.layerManager.loadPlanet(planet);

    const view = this.map.getView();
    view.setCenter([0, 0]);
    view.setZoom(2);
  }

  public activateTool(tool?: ToolType) {
    this.resetTools();
    if (tool === 'distance') this.enableDistanceTool();
  }

  public trackPointer(callback: (lon: number, lat: number, zoom: number) => void) {
    if (!this.map) return;
    const view = this.map.getView();
    this.map.on('pointermove', (evt: any) => {
      const coord = evt.coordinate;
      if (!coord) return;

      this.zone.run(() => {
        const [lon, lat] = toLonLat(coord);
        callback(+lon.toFixed(6), +lat.toFixed(6), +(view.getZoom() ?? 2).toFixed(2));
      });
    });
  }

  public saveDistanceLayer(name: string) {
    if (!this.measureSource || !this.measureSource.getFeatures().length) return;

    const featuresToSave = this.measureSource.getFeatures().map(f => f.clone());
    const planet = this.measurementPlanet ?? this.currentPlanet;

    this.layerManager.addDistanceLayer(planet, name, featuresToSave);
    this.resetTools();
  }

  // ================= INTERNAL HELPERS =================
  private resetTools() {
    if (this.drawInteraction && this.map) this.map.removeInteraction(this.drawInteraction);
    if (this.measureLayer && this.map) this.map.removeLayer(this.measureLayer);
    if (this.vertexLayer && this.map) this.map.removeLayer(this.vertexLayer);

    this.drawInteraction = undefined;
    this.measureLayer = undefined;
    this.vertexLayer = undefined;
    this.measureSource = undefined;
    this.vertexSource = undefined;
    this.measurementPlanet = undefined;
    this.clearDistanceTool = undefined;
    this.sessionColor = undefined;
  }

  private enableDistanceTool() {
    // Pick session color once
    const { color } = this.layerManager.styleService.getRandomStyleProps();
    this.sessionColor = color;
    this.measurementPlanet = this.currentPlanet;

    // ========== Main line layer ==========
    this.measureSource = new VectorSource();
    this.measureLayer = new VectorLayer({
      source: this.measureSource,
      style: (feature) => this.getDistanceStyle(feature)
    });
    this.map.addLayer(this.measureLayer);

    // ========== Vertex layer ==========
    this.vertexSource = new VectorSource();
    this.vertexLayer = new VectorLayer({
      source: this.vertexSource,
      style: (feature) =>
        new Style({
          geometry: () => feature.getGeometry(),
          image: new CircleStyle({
            radius: 6,
            fill: new Fill({ color: this.sessionColor! }),
            stroke: new Stroke({ color: '#000', width: 1 })
          })
        })
    });
    this.map.addLayer(this.vertexLayer);

    // ========== Draw interaction ==========
    this.drawInteraction = new Draw({
      source: this.measureSource,
      type: 'LineString',
      style: (feature) => this.getDistanceStyle(feature)
    });
    this.map.addInteraction(this.drawInteraction);

    let currentFeature: Feature | null = null;

    this.drawInteraction.on('drawstart', (evt: any) => {
      currentFeature = evt.feature;
    });

    this.drawInteraction.on('drawend', () => {
      currentFeature = null;
    });

    // ========== Live vertex dots before first click ==========
    const pointerMoveHandler = (evt: any) => {
      if (!this.vertexSource) return;
      const pointerCoord = evt.coordinate;
      this.vertexSource.clear();

      // Include last drawn points (if drawing)
      if (currentFeature) {
        const geom = currentFeature.getGeometry() as LineString;
        geom.getCoordinates().forEach((c) => this.vertexSource?.addFeature(new Feature(new Point(c))));
      }

      // Include pointer as “preview dot”
      if (pointerCoord) this.vertexSource.addFeature(new Feature(new Point(pointerCoord)));
    };
    this.map.on('pointermove', pointerMoveHandler);

    // ========== Right-click finish ==========
    const onRightClick = (evt: MouseEvent) => {
      evt.preventDefault();
      if (currentFeature) this.drawInteraction?.finishDrawing();
      this.map.getTargetElement().dispatchEvent(new CustomEvent('distance-save-request'));
    };
    this.map.getTargetElement().addEventListener('contextmenu', onRightClick);

    this.clearDistanceTool = () => {
      if (this.drawInteraction) this.map.removeInteraction(this.drawInteraction);
      if (this.measureLayer) this.map.removeLayer(this.measureLayer);
      if (this.vertexLayer) this.map.removeLayer(this.vertexLayer);

      this.drawInteraction = undefined;
      this.measureLayer = undefined;
      this.vertexLayer = undefined;
      this.measureSource = undefined;
      this.vertexSource = undefined;
      this.measurementPlanet = undefined;
      this.clearDistanceTool = undefined;
      this.sessionColor = undefined;

      this.map.getTargetElement().removeEventListener('contextmenu', onRightClick);
      this.map.un('pointermove', pointerMoveHandler);
    };
  }

  private getDistanceStyle(feature: FeatureLike) {
    const geom = feature.getGeometry();
    const color = this.sessionColor ?? '#633e0f';
    const styles: Style[] = [];

    if (geom?.getType() === 'LineString') {
      // Main line — always use current color dynamically
      styles.push(this.layerManager.styleService.getStyle(color, 'line'));

      // Big dots at vertices
      (geom as LineString).getCoordinates().forEach((coord) => {
        styles.push(
          new Style({
            geometry: () => new Point(coord),
            image: new CircleStyle({
              radius: 6,
              fill: new Fill({ color }),
              stroke: new Stroke({ color: '#000', width: 1 })
            })
          })
        );
      });
    } else {
      styles.push(this.layerManager.styleService.getStyle(color, 'line'));
    }

    return styles;
  }
}