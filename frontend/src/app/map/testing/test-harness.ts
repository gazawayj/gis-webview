/**
 * testing-utils.ts
 * 
 * This file provides reusable factory functions and common mocks to reduce 
 * boilerplate in service tests. By standardizing how services are created 
 * and how HttpClient is mocked, we ensure consistent test behavior across the app.
 * 
 * CORE TESTING CONCEPTS:
 * 1. Dependency Injection (DI) Mocking: We replace the real Angular HttpClient 
 *    with a mock to prevent actual network requests during unit tests.
 * 2. Generic Factory Pattern: The 'createService' function uses TypeScript 
 *    Generics to provide a type-safe way to initialize any Angular service 
 *    within the TestBed environment.
 */

import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { vi } from 'vitest';

/**
 * CLASS: MockHttpClient
 * 
 * A reusable mock for Angular's HttpClient. 
 * Instead of making real XHR/Fetch calls, it returns an Observable of an 
 * empty JSON object string.
 * 
 * We use 'vi.fn()' so that tests can spy on requests:
 * expect(httpMock.get).toHaveBeenCalledWith('api/data');
 */
export class MockHttpClient {
  /** 
   * Simulates an HTTP GET request.
   * Returns 'of("{}")' which is an RxJS Observable that emits immediately.
   */
  get = vi.fn(() => of('{}'));
}

/**
 * FUNCTION: createService<T>
 * 
 * A helper function to bootstrap the Angular TestBed for Service testing.
 * It automatically handles the injection of the MockHttpClient.
 * 
 * @param service - The class of the service to be tested (e.g., LayerManagerService).
 * @param providers - Optional array of extra mocks or providers specific to that test.
 * @returns The injected instance of the service.
 * 
 * USAGE: 
 * const service = createService(LayerManagerService, [{ provide: MapFacade, useValue: mock }]);
 */
export function createService<T>(service: new (...args: any[]) => T, providers: any[] = []): T {
  TestBed.configureTestingModule({
    providers: [
      /** The service under test itself */
      service,
      /** Defaulting HttpClient to our mock class for all services */
      { provide: HttpClient, useClass: MockHttpClient },
      /** Spread operator to include any test-specific providers passed in */
      ...providers
    ]
  });

  /** 
   * Returns the resolved instance of the service from the TestBed. 
   * This is equivalent to calling 'TestBed.inject(Service)'.
   */
  return TestBed.inject(service);
}
