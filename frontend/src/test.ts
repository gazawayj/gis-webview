// src/test.ts
import 'zone.js'; // Required by Angular
import 'zone.js/testing';
import { TestBed } from '@angular/core/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';

// =================== ResizeObserver Polyfill ===================
if (!(globalThis as any).ResizeObserver) {
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Make it globally available
(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver;

// =================== Angular TestBed Init ===================
TestBed.initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting()
);
