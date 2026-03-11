/**
 * map-facade.service.spec.ts
 * 
 * This suite tests the MapFacadeService, which acts as the "orchestrator" or 
 * "entry point" for the entire GIS system. It abstracts the complexity of 
 * OpenLayers, Events, and Layer Management into a single API for components.
 * 
 * TESTING STRATEGY:
 * 1. Facade Pattern: Since the Facade delegates work to MapEventService and 
 *    LayerManagerService, mock those dependencies to ensure this is 
 *    testing the coordination logic, not the underlying map engine.
 * 2. State Management: Verify that the Facade correctly tracks global 
 *    application state, such as which planet (Mars, Earth, Moon) is active.
 * 3. Initialization Flow: Ensure that calling 'initMap' correctly triggers 
 *    the setup sequence for all downstream services.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MapFacadeService } from './map-facade.service';
import { LayerManagerService } from './layer-manager.service';
import { MapEventService } from './map-event.service';
import { createMockMap } from '../testing/mock-map';

/**
 * MOCK: LayerManagerService
 * Mock this to verify that the Facade tells the LayerManager to 
 * attach to the map and load planet-specific data during initialization.
 */
class MockLayerManager {
  attachMap = vi.fn();
  loadPlanet = vi.fn();
}

/**
 * MOCK: MapEventService
 * Since the Facade exposes event streams (pointer position, hover), 
 * provide mock observables here so the service doesn't crash on subscription.
 */
class MockMapEvents {
  pointerState$ = { subscribe: vi.fn() };
  hoverFeature$ = { subscribe: vi.fn() };

  attachMap = vi.fn();
  registerContextMenuHandler = vi.fn();
}

describe('MapFacadeService', () => {

  let service: MapFacadeService;
  let layerManager: MockLayerManager;
  let mapEvents: MockMapEvents;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        MapFacadeService,
        /** 
         * Swap the real services for the mocks. This isolates the Facade 
         * and prevents "real" OpenLayers map events from firing in the background.
         */
        { provide: LayerManagerService, useClass: MockLayerManager },
        { provide: MapEventService, useClass: MockMapEvents }
      ]
    });

    service = TestBed.inject(MapFacadeService);
    layerManager = TestBed.inject(LayerManagerService) as unknown as MockLayerManager;
    mapEvents = TestBed.inject(MapEventService) as unknown as MockMapEvents;
  });

  /**
   * Test: Map Initialization
   * Verifies that providing an HTML container correctly kicks off the GIS engine.
   */
  it('should initialize map', () => {
    /** Create a "dummy" DOM element to act as the map's target div */
    const container = document.createElement('div');

    service.initMap(container);

    /** 
     * The Facade should default to 'mars' if no other planet is specified.
     * Check if it coordinates with LayerManager/Events.
     */
    expect(service.getCurrentPlanet()).toBe('mars');
    expect(layerManager.attachMap).toHaveBeenCalled();
    expect(mapEvents.attachMap).toHaveBeenCalled();
  });

  /**
   * Test: Planet Switching
   * Verifies that the Facade can update the global state.
   */
  it('should switch planets', () => {
    const container = document.createElement('div');
    service.initMap(container);

    /** Switch the context from the default 'mars' to 'earth' */
    service.setPlanet('earth');

    expect(service.getCurrentPlanet()).toBe('earth');
  });

});
