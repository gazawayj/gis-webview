import { Injectable, inject } from '@angular/core';
import Map from 'ol/Map';
import View from 'ol/View';
import { fromLonLat } from 'ol/proj';

import { LayerManagerService } from './layer-manager.service';
import { MapEventService } from './map-event.service';
import { LayerConfig } from '../models/layer-config.model';
import { Tool } from '../tools/tool';

@Injectable({ providedIn: 'root' })
export class MapFacadeService {

  private layerManager = inject(LayerManagerService);
  private mapEvents = inject(MapEventService);

  private map!: Map;
  private activePlugin?: Tool;

  private currentPlanet: 'earth' | 'moon' | 'mars' = 'mars';

  /** Cached view for each planet */
  private planetViewCache: Record<'earth' | 'moon' | 'mars', { center: [number, number]; zoom: number }> = {
    earth: { center: fromLonLat([-105.1660, 39.7047]) as [number, number], zoom: 13 },
    moon: { center: [0, 0], zoom: 2 },
    mars: { center: [0, 0], zoom: 2 }
  };

  // Expose observables from MapEventService
  pointerState$ = this.mapEvents.pointerState$;
  hoverFeature$ = this.mapEvents.hoverFeature$;

  /** Returns the current selected planet */
  getCurrentPlanet(): 'earth' | 'moon' | 'mars' {
    return this.currentPlanet;
  }

  /** Returns the currently active tool/plugin */
  getActivePlugin(): Tool | undefined {
    return this.activePlugin;
  }

  /** Initializes the map */
  initMap(container: HTMLElement): void {
    const view = new View();

    this.map = new Map({
      target: container,
      layers: [],
      view
    });

    // Attach map to services
    this.layerManager.attachMap(this.map);
    this.mapEvents.attachMap(this.map);

    // Load layers for the current planet
    this.layerManager.loadPlanet(this.currentPlanet);

    // Apply cached view
    this.applyPlanetView(this.currentPlanet);

    // Save current view whenever map moves or zoom changes
    this.map.on('moveend', () => this.saveCurrentView());          // Map event
    this.map.getView().on('change:resolution', () => this.saveCurrentView()); // View event
  }

  /** Registers a right-click handler (for plugin context menus) */
  registerContextMenuHandler(handler: () => void): void {
    this.mapEvents.registerContextMenuHandler(handler);
  }

  /** Switches to a different planet and reloads its layers */
  setPlanet(planet: 'earth' | 'moon' | 'mars'): void {
    if (!this.map || planet === this.currentPlanet) return;

    this.cancelActivePlugin();
    this.currentPlanet = planet;

    // Load planet layers
    this.layerManager.loadPlanet(planet);

    // Apply cached view for that planet
    this.applyPlanetView(planet);
  }

  /** Activates a tool/plugin on the map */
  activateTool(plugin?: Tool): void {
    this.cancelActivePlugin();

    if (!plugin || !this.map) return;

    this.activePlugin = plugin;
    plugin.activate(this.map);
  }

  /** Saves the currently active plugin to a layer */
  saveByActivePlugin(name: string): LayerConfig | undefined {
    if (!this.activePlugin?.save) return undefined;

    const layer = this.activePlugin.save(name);
    if (!layer) return undefined;

    this.activePlugin.cancel();
    this.activePlugin = undefined;

    return layer;
  }

  /** Cancels the currently active plugin */
  cancelActivePlugin(): void {
    if (!this.activePlugin) return;

    this.activePlugin.cancel();
    this.activePlugin = undefined;
  }

  /** Saves the current map view to the cache for the active planet */
  private saveCurrentView(): void {
    if (!this.map) return;

    const view = this.map.getView();
    this.planetViewCache[this.currentPlanet] = {
      center: view.getCenter() as [number, number],
      zoom: view.getZoom() || 2
    };
  }

  /** Applies cached view for a planet */
  private applyPlanetView(planet: 'earth' | 'moon' | 'mars'): void {
    if (!this.map) return;

    const view = this.map.getView();
    const cached = this.planetViewCache[planet];
    if (!cached) return;

    view.setCenter(cached.center);
    view.setZoom(cached.zoom);
  }
}