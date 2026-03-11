/**
 * mock-map.ts
 * 
 * This helper creates a "Fake" OpenLayers Map. 
 * Since OpenLayers relies on a real browser DOM/Canvas, mock the 
 * nested structure (Map -> View -> Viewport) so the services can 
 * 'attach' to them without a real browser.
 */

import { vi } from 'vitest';

/**
 * Creates a mock OpenLayers Map object.
 * Returns an 'any' type so it can be passed into services expecting a real Map.
 */
export function createMockMap() {
  /**
   * MOCK: Viewport
   * This represents the actual HTML element where the map lives.
   * MapEventService uses this to listen for 'contextmenu' (right-click) events.
   */
  const mockViewport = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  /**
   * MOCK: View
   * Handles the camera logic (zoom/center).
   */
  const mockView = {
    setCenter: vi.fn(),
    setZoom: vi.fn(),
    getCenter: vi.fn(() => [0, 0]),
    getZoom: vi.fn(() => 2),
    on: vi.fn()
  };

  return {
    /** 
     * getViewport()
     */
    getViewport: vi.fn(() => mockViewport),
    
    /** 
     * getLayers()
     * Used by LayerManager to push new layers onto the map stack.
     */
    getLayers: vi.fn(() => ({
      clear: vi.fn(),
      getArray: vi.fn(() => []),
      push: vi.fn()
    })),

    /** 
     * getView()
     * Used by MapEventService to check the zoom level during pointer moves.
     */
    getView: vi.fn(() => mockView),

    /** 
     * Event Handling (on/un)
     * These capture the callbacks (like 'pointermove') that the service 
     * wants the map to execute later.
     */
    on: vi.fn(),
    un: vi.fn(),

    /** 
     * Feature Detection
     * Used to figure out which icon is under the mouse.
     */
    forEachFeatureAtPixel: vi.fn(),

    // Basic map operations
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
    renderSync: vi.fn(),
    setTarget: vi.fn()
  } as any;
}
