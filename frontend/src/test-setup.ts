import 'zone.js';
import 'zone.js/testing';
import { getTestBed } from '@angular/core/testing';
// --- CHANGE THESE IMPORTS ---
import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';
import { vi } from 'vitest';

// THIS MUST RUN BEFORE ANY TESTS
getTestBed().initTestEnvironment(
  BrowserTestingModule,
  platformBrowserTesting()
);

// Polyfill ResizeObserver for OpenLayers
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
