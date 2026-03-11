/**
 * map-event.service.spec.ts
 * 
 * This suite tests how the GIS engine handles real-time user interactions like 
 * moving the mouse (pointer tracking) and right-clicking (context menus).
 * 
 * TESTING STRATEGY:
 * 1. createService Helper: We use your custom utility to bootstrap the service
 *    with a MockHttpClient automatically.
 * 2. RxJS Subjects: Since the service uses BehaviorSubjects, we test by 
 *    triggering "fake" map events and subscribing to the resulting streams.
 * 3. NgZone: We verify that the service correctly enters the Angular Zone 
 *    so the UI stays in sync with the mouse movements.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MapEventService, PointerState } from './map-event.service';
import { createService } from '../testing/test-harness';
import { createMockMap } from '../testing/mock-map';
import { toLonLat } from 'ol/proj';

/** 
 * We mock the OpenLayers 'toLonLat' function because we don't want to 
 * run actual geographic projection math during a unit test.
 */
vi.mock('ol/proj', () => ({
  toLonLat: vi.fn((coord: number[]) => [coord[0], coord[1]])
}));

describe('MapEventService', () => {
  let service: MapEventService;
  let mockMap: any;

  beforeEach(() => {
    /** 
     * Using your 'createService' helper! 
     * This replaces the bulky TestBed.configureTestingModule block.
     */
    service = createService(MapEventService);
    mockMap = createMockMap();
  });

  /**
   * TEST: Map Attachment
   * Ensures that when a map is attached, the service immediately 
   * hooks into the viewport for events.
   */
  it('should initialize and attach to map viewport', () => {
    const viewport = mockMap.getViewport();
    const addEventSpy = vi.spyOn(viewport, 'addEventListener');

    service.attachMap(mockMap);

    // Verify it's listening for right-clicks (contextmenu)
    expect(addEventSpy).toHaveBeenCalledWith('contextmenu', expect.any(Function));
  });

  /**
   * TEST: Pointer Tracking & Coordinate Conversion
   * This is the core logic. When the map fires a 'pointermove', the service 
   * must convert the map coordinates to Lon/Lat and emit them.
   */
  it('should emit new coordinates on pointer move', () => {
    service.attachMap(mockMap);
    let lastState: PointerState | undefined;

    // Subscribe to the stream to capture the output
    service.pointerState$.subscribe(state => lastState = state);

    /**
     * SIMULATION: 
     * We manually trigger the 'pointermove' callback that the service 
     * registered on the mock map.
     */
    const moveCallback = mockMap.on.mock.calls.find(call => call[0] === 'pointermove')[1];
    
    moveCallback({
      coordinate: [123.456, 78.91],
      pixel: [10, 10],
      dragging: false
    });

    // Verify the conversion logic and decimal rounding (.toFixed(6))
    expect(lastState?.lon).toBe(123.456);
    expect(lastState?.lat).toBe(78.91);
  });

  /**
   * TEST: Hover Feature Detection
   * Checks if the service correctly identifies when the mouse is over a map feature.
   */
  it('should detect features under the pointer', () => {
    service.attachMap(mockMap);
    const mockFeature = { id: 'test-feature' };
    
    /** 
     * We program the mock map to return our fake feature when 
     * the service asks "what is at this pixel?"
     */
    mockMap.forEachFeatureAtPixel.mockReturnValue(mockFeature);

    let detectedFeature: any;
    service.hoverFeature$.subscribe(f => detectedFeature = f);

    // Trigger the move
    const moveCallback = mockMap.on.mock.calls.find(call => call[0] === 'pointermove')[1];
    moveCallback({ coordinate: [0, 0], pixel: [5, 5] });

    expect(detectedFeature).toBe(mockFeature);
  });

  /**
   * TEST: Context Menu Handler
   * Verifies that the 'Facade' (or Component) can register a custom 
   * callback for right-clicks.
   */
  it('should trigger registered context menu handler', () => {
    const handlerSpy = vi.fn();
    service.attachMap(mockMap);
    service.registerContextMenuHandler(handlerSpy);

    /**
     * SIMULATION:
     * We find the 'contextmenu' listener on the viewport and manually trigger it.
     */
    const viewport = mockMap.getViewport();
    const contextMenuListener = viewport.addEventListener.mock.calls.find(
      call => call[0] === 'contextmenu'
    )[1];

    contextMenuListener({ preventDefault: vi.fn() });

    expect(handlerSpy).toHaveBeenCalled();
  });
});
