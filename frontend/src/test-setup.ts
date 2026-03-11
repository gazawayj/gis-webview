// frontend/src/test-setup.ts
// -----------------------------
// Angular + OpenLayers + Vitest Test Setup (Domino)
// -----------------------------

import 'zone.js';
import 'zone.js/testing';
import { TestBed } from '@angular/core/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';
import { vi } from 'vitest';
import * as domino from 'domino';

// OpenLayers Soft/Hard Mocks
import VectorImageLayer from 'ol/layer/VectorImage';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import Draw from 'ol/interaction/Draw';
import Modify from 'ol/interaction/Modify';
import Translate from 'ol/interaction/Translate';
import VectorLayer from 'ol/layer/Vector';

// -----------------------------
// Domino DOM Setup
// -----------------------------
const template = '<html><body><div id="map"></div></body></html>';
const win = domino.createWindow(template);

(global as any).window = win;
(global as any).document = win.document;
(global as any).self = win;

/**
 * FIX: Navigator (Read-only property)
 * Defines navigator as configurable to bypass the Node.js "getter only" error.
 */
Object.defineProperty(global, 'navigator', {
  value: { userAgent: 'node.js' },
  configurable: true,
  writable: true
});

// Assign Core Domino classes to Global scope
(global as any).Node = (win as any).Node;
(global as any).Element = (win as any).Element;
(global as any).HTMLElement = (win as any).HTMLElement;
(global as any).SVGElement = (win as any).SVGElement;
(global as any).MouseEvent = (win as any).MouseEvent;
(global as any).Event = (win as any).Event;

/**
 * FIX: KeyboardEvent Constructor Fallback
 * Domino sometimes provides KeyboardEvent as an object rather than a constructor.
 * This fallback ensures 'new KeyboardEvent()' works in Vitest.
 */
try {
  new (win as any).KeyboardEvent('keydown');
  (global as any).KeyboardEvent = (win as any).KeyboardEvent;
} catch (e) {
  (global as any).KeyboardEvent = class extends (global as any).Event {
    key: string;
    constructor(type: string, dict: any = {}) {
      super(type, dict);
      this.key = dict.key || '';
    }
  };
}

(global as any).HTMLAnchorElement = (win as any).HTMLAnchorElement || class { href = ''; click = vi.fn(); };

/**
 * FIX: DataTransfer Polyfill
 * Required for Angular CDK Drag-and-Drop tests.
 */
(global as any).DataTransfer = class {
  dropEffect = 'none';
  effectAllowed = 'all';
  files = [];
  items = [];
  types = [];
  setData = vi.fn();
  getData = vi.fn();
  clearData = vi.fn();
};

/**
 * FIX: getComputedStyle Polyfill
 * Required by OpenLayers to determine map container dimensions and visibility.
 */
(global as any).getComputedStyle = (el: HTMLElement) => {
  return {
    getPropertyValue: (prop: string) => {
      return (el as any).style ? (el as any).style[prop] : '';
    },
    display: 'block',
    visibility: 'visible',
    width: '1000px',
    height: '1000px',
    paddingLeft: '0',
    paddingTop: '0',
    paddingRight: '0',
    paddingBottom: '0',
  } as any;
};

// -----------------------------
// ShadowRoot Polyfill
// -----------------------------
if (typeof (global as any).ShadowRoot === 'undefined') {
  (global as any).ShadowRoot = class {
    host: any;
    constructor() { this.host = null; }
    appendChild = vi.fn();
    removeChild = vi.fn();
    querySelector = vi.fn();
    querySelectorAll = vi.fn(() => []);
  };
}

/**
 * FIX: URL Polyfill
 * Ensures URL is a valid constructor while adding missing Blob methods for GIS assets.
 */
if (typeof (global as any).URL === 'function') {
  (global as any).URL.createObjectURL = vi.fn(() => 'mock-url');
  (global as any).URL.revokeObjectURL = vi.fn();
} else {
  (global as any).URL = class {
    constructor(public url: string) { }
    static createObjectURL = vi.fn(() => 'mock-url');
    static revokeObjectURL = vi.fn();
  } as any;
}

// -----------------------------
// Node getRootNode Polyfill
// -----------------------------
if (!(global as any).Node.prototype.getRootNode) {
  (global as any).Node.prototype.getRootNode = function (this: any) {
    let node = this;
    while (node && node.parentNode) {
      node = node.parentNode;
    }
    return node;
  };
}

// -----------------------------
// Animation & Canvas Mocks
// -----------------------------
// FIX: Replaced 'Function' type with a specific arrow function signature
(global as any).requestAnimationFrame = (callback: (...args: any[]) => void) => setTimeout(callback, 0);
(global as any).cancelAnimationFrame = (id: number) => clearTimeout(id);

if (!(global as any).HTMLCanvasElement) {
  (global as any).HTMLCanvasElement = class extends (global as any).HTMLElement {
    getContext() {
      return {
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        getImageData: vi.fn(() => ({ data: new Uint8ClampedArray() })),
        putImageData: vi.fn(),
        setTransform: vi.fn(),
        drawImage: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
      };
    }
    toDataURL() { return ''; }
  };
}

// -----------------------------
// ResizeObserver Polyfill
// -----------------------------
(global as any).ResizeObserver = class {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
};

// -----------------------------
// Angular TestBed Initialization
// -----------------------------
import '@angular/compiler';
TestBed.initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting()
);

// -----------------------------
// OpenLayers Hard Mocks
// -----------------------------
vi.mock('ol/layer/Vector', () => ({
  default: class {
    setVisible = vi.fn();
    setZIndex = vi.fn();
    setStyle = vi.fn();
    changed = vi.fn();
    getSource = vi.fn(() => ({
      addFeature: vi.fn(),
      removeFeature: vi.fn(),
      getFeatures: vi.fn(() => []),
    }));
  },
}));

vi.mock('ol/layer/VectorImage', () => ({
  default: class {
    setVisible = vi.fn();
    setZIndex = vi.fn();
    setStyle = vi.fn();
    changed = vi.fn();
    getSource = vi.fn(() => ({
      addFeature: vi.fn(),
      removeFeature: vi.fn(),
      getFeatures: vi.fn(() => []),
    }));
  },
}));

vi.mock('ol/source/Vector', () => ({
  default: class {
    addFeature = vi.fn();
    removeFeature = vi.fn();
    getFeatures = vi.fn(() => []);
    clear = vi.fn();
    on = vi.fn();
  },
}));

// -----------------------------
// OpenLayers Soft Mocks (Prototypes)
// -----------------------------
Map.prototype.setTarget = vi.fn();
Map.prototype.addLayer = vi.fn();
Map.prototype.removeLayer = vi.fn();
Map.prototype.renderSync = vi.fn();
Map.prototype.render = vi.fn();
Map.prototype.getView = vi.fn(() => new View());

TileLayer.prototype.setVisible = vi.fn();

Draw.prototype.on = vi.fn();
Draw.prototype.setActive = vi.fn();

Modify.prototype.on = vi.fn();
Modify.prototype.setActive = vi.fn();

Translate.prototype.on = vi.fn();
Translate.prototype.setActive = vi.fn();

VectorLayer.prototype.changed = vi.fn();
VectorImageLayer.prototype.changed = vi.fn();
