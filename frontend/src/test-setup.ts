import 'zone.js';
import 'zone.js/testing';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';
import { vi } from 'vitest';

// 1. Initialize Angular Testing Environment
getTestBed().initTestEnvironment(
  BrowserTestingModule,
  platformBrowserTesting()
);

/**
 * Polyfill ResizeObserver for OpenLayers
 * This is here because OpenLayers calls 'new ResizeObserver()'
 * A simple vi.fn() results in a "is not a constructor" error.
 */
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

// Assign to the global scope for the JSDOM environment
(global as any).ResizeObserver = ResizeObserverMock;

/**
 * Optional: Mock URL.createObjectURL if you use it for Map tiles/blobs
 */
if (typeof window !== 'undefined' && !window.URL.createObjectURL) {
  window.URL.createObjectURL = vi.fn(() => 'mock-url');
}
