import { Injectable, NgZone, inject } from '@angular/core';
import Map from 'ol/Map';
import View from 'ol/View';
import { toLonLat } from 'ol/proj';
import { LayerConfig, LayerManagerService } from './layer-manager.service';
import { FeatureLike } from 'ol/Feature';
import { Style } from 'ol/style';
import { Tool } from '../tools/tool';

@Injectable({ providedIn: 'root' })
export class MapFacadeService {
  private zone = inject(NgZone);
  private layerManager = inject(LayerManagerService);
  map!: Map;
  private currentPlanet: 'earth' | 'moon' | 'mars' = 'earth';
  private activePlugin?: Tool;

  getActivePlugin(): Tool | undefined {
    return this.activePlugin;
  }

  initMap(container: HTMLElement, planet: 'earth' | 'moon' | 'mars') {
    this.currentPlanet = planet;

    const view = new View({ center: [0, 0], zoom: 2 });

    this.map = new Map({
      target: container,
      layers: [],
      view,
    });

    this.layerManager.attachMap(this.map);
    this.layerManager.loadPlanet(this.currentPlanet);
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

  setPlanet(planet: 'earth' | 'moon' | 'mars') {
    if (!this.map || planet === this.currentPlanet) return;
    this.cancelActivePlugin();
    this.currentPlanet = planet;
    this.layerManager.loadPlanet(planet);
    const view = this.map.getView();
    view.setCenter([0, 0]);
    view.setZoom(2);
  }

  activateTool(plugin: Tool) {
    this.cancelActivePlugin();
    this.activePlugin = plugin;
    plugin.activate(this.map);
  }

  saveActivePlugin(name: string): any {
    if (!this.activePlugin?.save) return undefined;

    const layer = this.activePlugin.save(name); // now save() returns LayerConfig
    this.activePlugin = undefined; // deactivate tool
    return layer; // <-- return layer to caller
  }

  cancelActivePlugin() {
    if (!this.activePlugin) return;
    this.activePlugin.cancel();
    this.activePlugin = undefined;
  }
}