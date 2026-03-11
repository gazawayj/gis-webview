/**
 * map-event.service.spec.ts
 *
 * Unit tests for MapEventService, handling pointer movement,
 * hover detection, and context menu events on the OpenLayers map.
 *
 * TESTING STRATEGY:
 * 1. Use createService helper for clean DI.
 * 2. Simulate map events via a fully mocked map object.
 * 3. Verify RxJS subjects emit expected pointer and hover states.
 */

import '../../../test-setup';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MapEventService, PointerState } from './map-event.service';
import { createService } from '../testing/test-harness';
import { createMockMap } from '../testing/mock-map';

/**
 * MOCK: ol/proj.toLonLat
 * Prevents actual geographic projection calculations.
 * Returns the same coordinates for predictability in tests.
 */
vi.mock('ol/proj', () => ({
  toLonLat: vi.fn((coord: number[]) => [coord[0], coord[1]])
}));

describe('MapEventService', () => {
  let service: MapEventService;
  let mockMap: ReturnType<typeof createMockMap>;

  beforeEach(() => {
    service = createService(MapEventService);
    mockMap = createMockMap();
  });

  it('should attach to map viewport', () => {
    const viewport = mockMap.getViewport();
    const addEventSpy = vi.spyOn(viewport, 'addEventListener');

    service.attachMap(mockMap);

    expect(addEventSpy).toHaveBeenCalledWith('contextmenu', expect.any(Function));
  });

  it('should emit pointer coordinates on pointer move', () => {
    service.attachMap(mockMap);
    let emittedState: PointerState | undefined;

    service.pointerState$.subscribe(state => {
      emittedState = state;
    });

    /**
     * Locate the registered pointermove callback.
     */
    const moveCall = mockMap.on.mock.calls.find(
      (call: [string, (evt: unknown) => void]) => call[0] === 'pointermove'
    );

    const moveCallback = moveCall![1] as (evt: any) => void;

    /**
     * Simulate pointermove event.
     */
    moveCallback({
      coordinate: [123.456, 78.91],
      pixel: [10, 10],
      dragging: false
    });

    expect(emittedState?.lon).toBe(123.456);
    expect(emittedState?.lat).toBe(78.91);
  });

  it('should emit the feature under pointer', () => {
    service.attachMap(mockMap);

    const mockFeature = { id: 'feature1' };
    mockMap.forEachFeatureAtPixel.mockReturnValue(mockFeature);

    let detectedFeature: unknown;

    service.hoverFeature$.subscribe(feature => {
      detectedFeature = feature;
    });

    /**
     * Trigger pointermove event.
     */
    const moveCall = mockMap.on.mock.calls.find(
      (call: [string, (evt: unknown) => void]) => call[0] === 'pointermove'
    );

    const moveCallback = moveCall![1] as (evt: any) => void;

    moveCallback({
      coordinate: [0, 0],
      pixel: [5, 5]
    });

    expect(detectedFeature).toBe(mockFeature);
  });

  it('should call registered context menu handler on right-click', () => {
    const handlerSpy = vi.fn();

    service.attachMap(mockMap);
    service.registerContextMenuHandler(handlerSpy);

    const viewport = mockMap.getViewport();

    /**
     * Locate contextmenu listener.
     */
    const contextCall = viewport.addEventListener.mock.calls.find(
      (call: [string, (evt: unknown) => void]) => call[0] === 'contextmenu'
    );

    const contextMenuListener = contextCall![1] as (evt: any) => void;

    contextMenuListener({
      preventDefault: vi.fn()
    });

    expect(handlerSpy).toHaveBeenCalled();
  });
});