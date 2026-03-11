import 'zone.js';
import 'zone.js/testing';
import { TestBed } from '@angular/core/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';
import { vi } from 'vitest';
import VectorImageLayer from 'ol/layer/VectorImage';

// Initialize Angular TestBed
TestBed.initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting()
);

// -----------------------------
// ResizeObserver Polyfill
// -----------------------------
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

(global as any).ResizeObserver = ResizeObserverMock;

// -----------------------------
// URL.createObjectURL Mock
// -----------------------------
if (typeof window !== 'undefined' && !window.URL.createObjectURL) {
  window.URL.createObjectURL = vi.fn(() => 'mock-url');
}

// -----------------------------
// OpenLayers Hard Mocks
// Prevents OL from attaching DOM listeners
// -----------------------------

vi.mock('ol/layer/Vector', () => {
  return {
    default: class {
      setVisible = vi.fn();
      setZIndex = vi.fn();
      setStyle = vi.fn();
      getSource = vi.fn(() => ({
        addFeature: vi.fn(),
        removeFeature: vi.fn(),
        getFeatures: vi.fn(() => [])
      }));
    }
  };
});

vi.mock('ol/layer/VectorImage', () => {
  return {
    default: class {
      setVisible = vi.fn();
      setZIndex = vi.fn();
      setStyle = vi.fn();
      getSource = vi.fn(() => ({
        addFeature: vi.fn(),
        removeFeature: vi.fn(),
        getFeatures: vi.fn(() => [])
      }));
    }
  };
});

vi.mock('ol/source/Vector', () => {
  return {
    default: class {
      addFeature = vi.fn();
      removeFeature = vi.fn();
      getFeatures = vi.fn(() => []);
      clear = vi.fn();
    }
  };
});

// -----------------------------
// OpenLayers Soft Mocks
// -----------------------------
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import Draw from 'ol/interaction/Draw';
import Modify from 'ol/interaction/Modify';
import Translate from 'ol/interaction/Translate';
import VectorLayer from 'ol/layer/Vector';

// Mock Map behavior
Map.prototype.setTarget = vi.fn();
Map.prototype.addLayer = vi.fn();
Map.prototype.removeLayer = vi.fn();
Map.prototype.renderSync = vi.fn();
Map.prototype.getView = vi.fn(() => new View());

// Mock TileLayer
TileLayer.prototype.setVisible = vi.fn();

// -----------------------------
// Interaction Mocks
// -----------------------------
Draw.prototype.on = vi.fn();
Draw.prototype.setActive = vi.fn();

Modify.prototype.on = vi.fn();
Modify.prototype.setActive = vi.fn();

Translate.prototype.on = vi.fn();
Translate.prototype.setActive = vi.fn();

VectorLayer.prototype.changed = vi.fn();
VectorImageLayer.prototype.changed = vi.fn();