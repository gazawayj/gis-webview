// COMPLETE FILE: frontend/src/app/map/services/map-facade.service.ts
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
import { LayerManagerService, LayerConfig } from './layer-manager.service';
import Style from 'ol/style/Style';
import Stroke from 'ol/style/Stroke';
import CircleStyle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import Text from 'ol/style/Text';
import { toLonLat } from 'ol/proj';
import { getDistance } from 'ol/sphere';
import { PLANETS } from '../map-constants';

@Injectable({ providedIn: 'root' })
export class MapFacadeService {
  map!: Map;
  private currentPlanet: 'earth' | 'moon' | 'mars' = 'earth';
  private drawInteraction?: Draw;
  private measureSource?: VectorSource;
  private measureLayer?: VectorLayer<VectorSource>;
  private clearDistanceTool?: () => void;

  constructor(private zone: NgZone, private layerManager: LayerManagerService) {}

  // ================= INIT MAP =================
  initMap(container: HTMLElement, planet: 'earth' | 'moon' | 'mars') {
    this.currentPlanet = planet;

    const view = new View({
      center: [0, 0],
      zoom: 2
    });

    this.map = new Map({
      target: container,
      layers: [],
      view
    });

    this.layerManager.attachMap(this.map);
    this.layerManager.loadPlanet(this.currentPlanet);
  }

  // ================= TOOL ACTIVATION =================
  activateTool(tool?: ToolType) {
    this.clearInteractions();
    if (tool === 'distance') this.enableDistanceTool();
  }

  // ================= POINTER TRACKING =================
  trackPointer(callback: (lon: number, lat: number, zoom: number) => void) {
    if (!this.map) return;
    const view = this.map.getView();

    this.map.on('pointermove', (evt: any) => {
      const coord = evt.coordinate;
      if (!coord) return;

      this.zone.run(() => {
        const [lon, lat] = toLonLat(coord);
        callback(
          +lon.toFixed(6),
          +lat.toFixed(6),
          +(view.getZoom() ?? 2).toFixed(2)
        );
      });
    });
  }

  // ================= DISTANCE TOOL =================
  private enableDistanceTool() {
    const primaryColor = this.getPrimaryColor();

    // Lock the planet at the start of this draw session
    const planetForThisDraw = this.currentPlanet;

    this.measureSource = new VectorSource();
    this.measureLayer = new VectorLayer({
      source: this.measureSource,
      style: this.getDistanceStyle(primaryColor),
    });
    this.map.addLayer(this.measureLayer);

    this.drawInteraction = new Draw({
      source: this.measureSource,
      type: 'LineString',
      style: this.getDistanceStyle(primaryColor)
    });
    this.map.addInteraction(this.drawInteraction);

    let currentFeature: Feature | null = null;

    this.drawInteraction.on('drawstart', (evt: any) => {
      currentFeature = evt.feature;
      const geom = currentFeature?.getGeometry() as LineString;
      if (!geom) return;

      geom.on('change', () => {
        const coords = geom.getCoordinates();
        if (coords.length < 2) return;

        this.measureSource?.clear();
        const segmentFeatures: Feature[] = [];

        for (let i = 1; i < coords.length; i++) {
          const start = coords[i - 1];
          const end = coords[i];

          // Line segment
          segmentFeatures.push(new Feature({ geometry: new LineString([start, end]) }));

          // Distance calculation using planet-specific radius
          const startLonLat = toLonLat(start) as [number, number];
          const endLonLat = toLonLat(end) as [number, number];

          const distMeters = getDistance(
            startLonLat,
            endLonLat,
            PLANETS[planetForThisDraw].radius
          );

          // Format label
          const distLabel = distMeters >= 1000
            ? `${(distMeters / 1000).toFixed(2)} km`
            : `${distMeters.toFixed(1)} m`;

          // Midpoint for label
          const mid = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
          const label = new Feature({
            geometry: new Point(mid),
            distanceLabel: distLabel,
            zindex: 100100
          });

          // Label style always on top
          label.setStyle(new Style({
            zIndex: 1001,
            text: new Text({
              text: label.get('distanceLabel'),
              font: 'bold 12px sans-serif',
              fill: new Fill({ color: '#000' }),
              stroke: new Stroke({ color: '#fff', width: 4 }),
              overflow: true
            })
          }));

          segmentFeatures.push(label);
        }

        this.measureSource?.addFeatures(segmentFeatures);
      });
    });

    this.drawInteraction.on('drawend', () => currentFeature = null);

    // Right-click: finish line + trigger save modal
    const onRightClick = (evt: MouseEvent) => {
      evt.preventDefault();
      if (currentFeature) this.drawInteraction?.finishDrawing();
      this.map.getTargetElement().dispatchEvent(new CustomEvent('distance-save-request'));
    };

    this.map.getTargetElement().addEventListener('contextmenu', onRightClick);

    // Cleanup
    this.clearDistanceTool = () => {
      if (this.drawInteraction) this.map.removeInteraction(this.drawInteraction);
      if (this.measureLayer) this.map.removeLayer(this.measureLayer);
      this.drawInteraction = undefined;
      this.measureLayer = undefined;
      this.measureSource = undefined;
      this.clearDistanceTool = undefined;
      this.map.getTargetElement().removeEventListener('contextmenu', onRightClick);
    };
  }

  /** Saves the distance measurement as a sidebar layer under the correct planet */
  saveDistanceLayer(name: string) {
    if (!this.measureSource || !this.measureSource.getFeatures().length) return;

    const featuresToSave = this.measureSource.getFeatures();
    const distanceLayer = new VectorLayer({
      source: new VectorSource({ features: featuresToSave }),
      style: () => new Style({ stroke: new Stroke({ color: '#633e0f', width: 3 }) }),
      zIndex: 1000
    });

    const distanceConfig: LayerConfig = {
      id: `distance-${Date.now()}`,
      name,
      color: '#633e0f',
      shape: 'none',
      visible: true,
      olLayer: distanceLayer,
      sourceType: 'GeoJSON',
      description: 'Distance measurement layer'
    };

    // Save layer to the planet that was active when drawing started
    const planetForThisDraw = this.currentPlanet;
    this.layerManager.registerLayer(distanceConfig, planetForThisDraw);

    this.clearDistanceTool?.();
  }

  private getDistanceStyle(color: string) {
    return (feature: FeatureLike) => [
      new Style({
        stroke: new Stroke({ color: '#000', width: 5 }),
        image: new CircleStyle({ radius: 6, fill: new Fill({ color: '#000' }) })
      }),
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

  private getPrimaryColor(): string {
    return getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim() || '#633e0f';
  }

  private clearInteractions() {
    if (this.drawInteraction) this.map.removeInteraction(this.drawInteraction);
    this.drawInteraction = undefined;
    if (this.measureLayer) this.map.removeLayer(this.measureLayer);
    this.measureLayer = undefined;
    this.measureSource = undefined;
  }

  // ================= PLANET SWITCH =================
  setPlanet(planet: 'earth' | 'moon' | 'mars') {
    if (!this.map) return;
    this.currentPlanet = planet;
    this.layerManager.loadPlanet(planet);

    const view = this.map.getView();
    view.setCenter([0, 0]);
    view.setZoom(2);
  }
}
