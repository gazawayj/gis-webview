import 'zone.js';
import 'zone.js/testing';
import { TestBed } from '@angular/core/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';
import { vi } from 'vitest';

// Initialize Angular TestBed
TestBed.initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting()
);

// ResizeObserver polyfill
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
(global as any).ResizeObserver = ResizeObserverMock;

// Optional mock for URL.createObjectURL
if (typeof window !== 'undefined' && !window.URL.createObjectURL) {
  window.URL.createObjectURL = vi.fn(() => 'mock-url');
}
