/**
 * test-harness.ts
 * 
 * Provides reusable factory functions and mocks for Angular service tests.
 * Designed to be independent of Vitest/Jasmine globals (no beforeEach/it here).
 * 
 * CORE CONCEPTS:
 * 1. MockHttpClient: Prevents real HTTP calls and allows spying.
 * 2. createService<T>: Type-safe factory to create any Angular service with optional extra providers.
 */
import '../../../test-setup'; 
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { vi } from 'vitest';

/**
 * CLASS: MockHttpClient
 * 
 * A reusable mock for Angular's HttpClient.
 * Returns a simple Observable of an empty JSON string.
 * Can be spied on in tests using Vitest's vi.fn().
 */
export class MockHttpClient {
  /** Simulates HttpClient.get */
  get = vi.fn(() => of('{}'));

  /** Simulates HttpClient.post */
  post = vi.fn(() => of('{}'));

  /** Simulates HttpClient.put */
  put = vi.fn(() => of('{}'));

  /** Simulates HttpClient.delete */
  delete = vi.fn(() => of('{}'));
}

/**
 * FUNCTION: createService<T>
 * 
 * Initializes Angular TestBed for a service test.
 * Automatically provides MockHttpClient and optional additional providers.
 * 
 * @param service - The class of the service to test.
 * @param providers - Optional array of additional Angular providers/mocks.
 * @returns Injected instance of the service.
 * 
 * USAGE:
 * const service = createService(LayerManagerService, [{ provide: MapFacade, useValue: mock }]);
 */
export function createService<T>(
  service: new (...args: any[]) => T,
  providers: any[] = []
): T {
  // Reset TestBed to prevent duplicate module errors in multiple tests
  TestBed.resetTestingModule();

  TestBed.configureTestingModule({
    providers: [
      service,
      { provide: HttpClient, useClass: MockHttpClient },
      ...providers,
    ],
  });

  return TestBed.inject(service);
}