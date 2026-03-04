import { Injectable, NgZone, inject } from '@angular/core';
import Map from 'ol/Map';
import View from 'ol/View';
import { toLonLat } from 'ol/proj';
import { LayerManagerService } from './layer-manager.service';
import { LayerConfig } from '../models/layer-config.model';
import { Tool } from '../tools/tool';

@Injectable({ providedIn: 'root' })
export class MapFacadeService {
  private zone = inject(NgZone);
  private layerManager = inject(LayerManagerService);

  map!: Map;

  // Mars default
  private currentPlanet: 'earth' | 'moon' | 'mars' = 'mars';

  private activePlugin?: Tool;
  private aiModalOpener?: () => void;

  getActivePlugin(): Tool | undefined {
    return this.activePlugin;
  }

  trackPointer(callback: (lon: number, lat: number, zoom: number) => void) {
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

  // Default planet is Mars
  initMap(container: HTMLElement, planet: 'earth' | 'moon' | 'mars' = 'mars') {
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

    // LayerManager handles basemap creation
    this.layerManager.loadPlanet(this.currentPlanet);
  }

  setPlanet(planet: 'earth' | 'moon' | 'mars') {
    if (!this.map || planet === this.currentPlanet) return;

    this.cancelActivePlugin();

    this.currentPlanet = planet;
    this.layerManager.loadPlanet(planet);

    const view = this.map.getView();
    view.setCenter([0, 0]);
    view.setZoom(2);
  }

  activateTool(plugin?: Tool) {
    this.cancelActivePlugin();
    if (!plugin) return;
    this.activePlugin = plugin;
    plugin.activate(this.map);
  }

  saveByActivePlugin(name: string): LayerConfig | undefined {
    if (!this.activePlugin?.save) return undefined;
    const layer = this.activePlugin.save(name);
    if (!layer) return undefined;
    this.activePlugin.cancel();
    this.activePlugin = undefined;
    return layer;
  }

  cancelActivePlugin() {
    if (!this.activePlugin) return;
    this.activePlugin.cancel();
    this.activePlugin = undefined;
  }

  registerAiModalOpener(fn: () => void) {
    this.aiModalOpener = fn;
  }

  openAiModal() {
    this.aiModalOpener?.();
  }
}