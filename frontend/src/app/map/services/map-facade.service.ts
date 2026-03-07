import { Injectable, NgZone, inject } from '@angular/core';
import Map from 'ol/Map';
import View from 'ol/View';
import { toLonLat, fromLonLat } from 'ol/proj';
import { LayerManagerService } from './layer-manager.service';
import { LayerConfig } from '../models/layer-config.model';
import { Tool } from '../tools/tool';

@Injectable({ providedIn: 'root' })
export class MapFacadeService {
  private zone = inject(NgZone);
  private layerManager = inject(LayerManagerService);
  map!: Map;

  private currentPlanet: 'earth' | 'moon' | 'mars' = 'mars';
  private activePlugin?: Tool;
  private aiModalOpener?: () => void;

  // Cache per planet: center + zoom
  private planetViewCache: Record<'earth' | 'moon' | 'mars', { center: [number, number]; zoom: number }> = {
    earth: { center: fromLonLat([-105.1660, 39.7047]) as [number, number], zoom: 13 },
    moon: { center: [0, 0], zoom: 2 },
    mars: { center: [0, 0], zoom: 2 }
  };

  getActivePlugin(): Tool | undefined {
    return this.activePlugin;
  }

  getCurrentPlanet(): 'earth' | 'moon' | 'mars' {
    return this.currentPlanet;
  }

  trackPointer(callback: (lon: number, lat: number, zoom: number) => void) {
    if (!this.map) return;
    const view = this.map.getView();

    const updateCache = () => {
      const center = view.getCenter();
      const zoom = view.getZoom();
      if (center && center.length >= 2 && zoom !== undefined) {
        this.planetViewCache[this.currentPlanet] = {
          center: [center[0], center[1]],
          zoom
        };
      }
    };

    // Track pointer move for display
    this.map.on('pointermove', (evt: any) => {
      const coord = evt.coordinate;
      if (!coord) return;

      this.zone.run(() => {
        const [lon, lat] = toLonLat(coord);
        callback(+lon.toFixed(6), +lat.toFixed(6), +(view.getZoom() ?? 2));
        updateCache();
      });
    });

    // Track panning/zooming
    this.map.on('moveend', () => updateCache());
  }

  initMap(container: HTMLElement) {
    const view = new View();
    this.map = new Map({
      target: container,
      layers: [],
      view
    });

    this.layerManager.attachMap(this.map);
    // Initialize planet using current state
    this.layerManager.loadPlanet(this.currentPlanet);
    // Restore cached/default view
    this.applyPlanetView(this.currentPlanet);
  }

  setPlanet(planet: 'earth' | 'moon' | 'mars') {
    if (!this.map || planet === this.currentPlanet) return;
    this.cancelActivePlugin();
    this.currentPlanet = planet;
    this.layerManager.loadPlanet(planet);
    // Restore last view for planet
    this.applyPlanetView(planet);
  }

  private applyPlanetView(planet: 'earth' | 'moon' | 'mars') {
    const view = this.map.getView();
    const cached = this.planetViewCache[planet];
    if (cached) {
      view.setCenter(cached.center);
      view.setZoom(cached.zoom);
    }
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