/**
 * highres-selection.plugin.spec.ts
 *
 * Unit tests for HighResSelectionPlugin.
 * 
 * Note: These tests use a real OpenLayers Map with mocked interactions.
 * Mocks must implement setMap, getMap, and getActive to satisfy 
 * OpenLayers' internal interaction validation.
 */

import '../../../test-setup';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HighResSelectionPlugin } from './highres-selection.plugin';
import Map from 'ol/Map';
import View from 'ol/View';
import VectorSource from 'ol/source/Vector';

/** 
 * Shared registry to capture event listeners attached to mocks 
 * during plugin activation.
 */
let drawEvents: Record<string, (event?: any) => void> = {};

/**
 * Creates a base mock object that satisfies the ol/interaction/Interaction interface.
 * Required because ol/Map calls .setMap() and checks .getActive() internally.
 */
const createBaseMockInteraction = () => ({
  on: vi.fn((event: string, cb: (event?: any) => void) => { 
    if (event === 'drawend' || event === 'drawstart') drawEvents[event] = cb; 
  }),
  setActive: vi.fn(),
  setMap: vi.fn(),
  getMap: vi.fn(),
  getActive: vi.fn(() => true),
  dispatchEvent: vi.fn()
});

// ----------------------
// MOCK Draw
// ----------------------
vi.mock('ol/interaction/Draw', () => {
  return {
    default: class {
      constructor() { 
        Object.assign(this, createBaseMockInteraction()); 
      }
      on(event: string, cb: (event?: any) => void) { 
        drawEvents[event] = cb; 
      }
    },
    createBox: vi.fn(() => vi.fn())
  };
});

// ----------------------
// MOCK Modify
// ----------------------
vi.mock('ol/interaction/Modify', () => ({
  default: class { 
    constructor() { Object.assign(this, createBaseMockInteraction()); } 
  }
}));

// ----------------------
// MOCK Translate
// ----------------------
vi.mock('ol/interaction/Translate', () => ({
  default: class { 
    constructor() { Object.assign(this, createBaseMockInteraction()); } 
  }
}));

describe('HighResSelectionPlugin', () => {
  let plugin: HighResSelectionPlugin;
  let map: Map;
  let layerManager: any;

  beforeEach(() => {
    vi.clearAllMocks();
    drawEvents = {};

    map = new Map({
      target: document.createElement('div'),
      view: new View({ center: [0, 0], zoom: 2 })
    });

    layerManager = {
      currentPlanet: 'mars',
      startExternalLoad: vi.fn(),
      endExternalLoad: vi.fn(),
      styleService: {
        allocateLayerStyle: vi.fn(() => ({ shape: 'circle', color: '#ff0000' })),
        getLayerStyle: vi.fn(() => [])
      },
      createLayer: vi.fn(() => ({
        olLayer: { getSource: () => new VectorSource() },
        color: '#ff0000',
        shape: 'circle'
      })),
      remove: vi.fn()
    };

    plugin = new HighResSelectionPlugin(layerManager);

    // Mock the source and include the specific method the plugin calls
    const mockSource = new VectorSource();
    (mockSource as any).getFeaturesCollection = vi.fn(() => null);

    (plugin as any).map = map;
    (plugin as any).tempSource = mockSource;
  });

  /**
   * Test: Activation
   */
  it('should activate without errors and register draw interaction', () => {
    expect(() => (plugin as any).onActivate()).not.toThrow();
    expect((plugin as any).drawInteraction).toBeDefined();
    expect(drawEvents['drawend']).toBeDefined();
  });

  /**
   * Test: Transition to Editing
   */
  it('should enable modify and translate on draw end', () => {
    (plugin as any).onActivate();
    
    (plugin as any).selectionFeature = {
      getGeometry: () => ({ 
        getExtent: () => [0, 0, 10, 10]
      }),
      set: vi.fn()
    };

    // Trigger the drawend callback
    drawEvents['drawend']!({ 
      feature: (plugin as any).selectionFeature 
    });

    expect((plugin as any).modifyInteraction).toBeDefined();
    expect((plugin as any).translateInteraction).toBeDefined();
  });

  /**
   * Test: User Cancellation
   */
  it('should cancel on Escape key', () => {
    const cancelSpy = vi.spyOn(plugin, 'cancel');

    (plugin as any).onActivate();

    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    window.dispatchEvent(event);

    expect(cancelSpy).toHaveBeenCalled();
  });
});
