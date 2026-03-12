/**
 * highres-selection.plugin.spec.ts
 *
 * Fixed mocks and tests for HighResSelectionPlugin.
 */
import '../../../test-setup';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HighResSelectionPlugin } from './highres-selection.plugin';
import Map from 'ol/Map';
import { Draw, Modify, Translate } from 'ol/interaction';

// ----------------------
// MOCK OpenLayers
// ----------------------
const mockDrawOn = vi.fn();
const mockDrawSetActive = vi.fn();
const mockModifySetActive = vi.fn();
const mockTranslateSetActive = vi.fn();

vi.mock('ol/interaction', () => ({
  Draw: vi.fn().mockImplementation(() => ({
    on: mockDrawOn,
    setActive: mockDrawSetActive,
  })),
  Modify: vi.fn().mockImplementation(() => ({
    setActive: mockModifySetActive,
  })),
  Translate: vi.fn().mockImplementation(() => ({
    setActive: mockTranslateSetActive,
  })),
}));

vi.mock('ol/layer/Vector', () => ({
  default: vi.fn().mockImplementation(() => ({
    setSource: vi.fn(),
    getSource: vi.fn().mockReturnValue({ addFeature: vi.fn(), removeFeature: vi.fn() }),
  })),
}));

vi.mock('ol/source/Vector', () => ({
  default: vi.fn().mockImplementation(() => ({})),
}));

// ----------------------
// MOCK jsdom document
// ----------------------
if (typeof document === 'undefined') {
  global.document = {
    createElement: () => ({ style: {}, appendChild: vi.fn() }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as any;
}

describe('HighResSelectionPlugin', () => {
  let plugin: HighResSelectionPlugin;
  let map: Map;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    plugin = new HighResSelectionPlugin();
    map = new Map();
    (plugin as any).map = map;
  });

  it('should activate without errors and register draw interaction', () => {
    expect(() => plugin.onActivate()).not.toThrow();
    expect(Draw).toHaveBeenCalled();
    expect(mockDrawOn).toHaveBeenCalled();
  });

  it('should enable modify and translate on draw end', () => {
    plugin.onActivate();

    // Simulate drawend callback
    const drawCallback = mockDrawOn.mock.calls.find(([event]) => event === 'drawend')?.[1];
    expect(drawCallback).toBeDefined();
    drawCallback({ feature: {} });

    expect(Modify).toHaveBeenCalled();
    expect(Translate).toHaveBeenCalled();
  });

  it('should cancel on Escape key', () => {
    plugin.onActivate();
    (plugin as any).drawInteraction = { setActive: mockDrawSetActive };

    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(event);

    expect(mockDrawSetActive).toHaveBeenCalledWith(false);
  });
});