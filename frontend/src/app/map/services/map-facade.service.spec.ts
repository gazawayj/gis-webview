/**
 * map-facade.service.spec.ts
 *
 * Unit tests for MapFacadeService, the orchestrator of the GIS system.
 * This version uses Vitest with jsdom to avoid document/DOM issues in Node.
 *
 * TESTING STRATEGY:
 * 1. Mock dependencies (LayerManagerService, MapEventService) for orchestration testing.
 * 2. Verify current planet state and dependent service calls.
 * 3. Simulate DOM container in jsdom rather than relying on a real browser.
 */
import '../../../test-setup'; 
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MapFacadeService } from './map-facade.service';
import { LayerManagerService } from './layer-manager.service';
import { MapEventService } from './map-event.service';
import { createService, MockHttpClient } from '../testing/test-harness';
import { HttpClient } from '@angular/common/http';

/**
 * MOCK: LayerManagerService
 */
class MockLayerManager {
  attachMap = vi.fn();
  loadPlanet = vi.fn();
}

/**
 * MOCK: MapEventService
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
    service = createService(MapFacadeService, [
      { provide: LayerManagerService, useClass: MockLayerManager },
      { provide: MapEventService, useClass: MockMapEvents },
      { provide: HttpClient, useClass: MockHttpClient }
    ]);

    // Cast to mock types for spying
    layerManager = service['layerManager'] as unknown as MockLayerManager;
    mapEvents = service['mapEvents'] as unknown as MockMapEvents;
  });

  it('should initialize map without DOM errors', () => {
    // jsdom provides a fake DOM
    const container = document.createElement('div');

    service.initMap(container);

    expect(service.getCurrentPlanet()).toBe('mars');
    expect(layerManager.attachMap).toHaveBeenCalled();
    expect(mapEvents.attachMap).toHaveBeenCalled();
  });

  it('should switch planets correctly', () => {
    const container = document.createElement('div');
    service.initMap(container);

    service.setPlanet('earth');

    expect(service.getCurrentPlanet()).toBe('earth');
  });

  it('should register context menu handler', () => {
    const handler = vi.fn();
    service.registerContextMenuHandler(handler);

    expect(mapEvents.registerContextMenuHandler).toHaveBeenCalledWith(handler);
  });
});
