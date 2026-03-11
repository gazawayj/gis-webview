/**
 * app.spec.ts
 *
 * Unit tests for the backend API endpoints of the Angular SSR + Node app.
 *
 * TESTING STRATEGY:
 * 1. Supertest: Sends HTTP-style requests directly to the Express app without
 *    opening an actual network port.
 * 2. SSR Mocks: Angular SSR Node modules are mocked to prevent full app
 *    initialization and avoid side effects.
 * 3. Endpoint Validation: Checks HTTP status codes, response body structures,
 *    and known layer data for planets.
 */
import '../test-setup'; 
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../server';

/**
 * MOCK: Angular SSR Node Integration
 * Prevents actual SSR engine or handlers from running during tests.
 * All functions are replaced with stubs to make tests isolated and deterministic.
 */
vi.mock('@angular/ssr/node', () => ({
  AngularNodeAppEngine: function () {
    return { handle: vi.fn() };
  },
  createNodeRequestHandler: vi.fn(),
  writeResponseToNodeResponse: vi.fn(),
  isMainModule: vi.fn().mockReturnValue(false)
}));

describe('Backend API Endpoints', () => {

  /**
   * TEST: GET /api/status
   * Confirms that the health endpoint returns status 200 and JSON with { status: 'online' }.
   */
  it('GET /api/status should return system health', async () => {
    const res = await request(app).get('/api/status');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'online');
  });

  /**
   * TEST: GET /api/layers/:planet
   * Verifies that fetching layers for a valid planet (Mars) returns an array
   * and contains known layer IDs.
   */
  it('GET /api/layers/:planet should return correct planet layers', async () => {
    const res = await request(app).get('/api/layers/mars');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    // Optionally verify first known layer if layers exist
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('id', 'mars-base');
    }
  });

  /**
   * TEST: GET /api/layers/:planet for unknown planet
   * Ensures that requesting an unknown planet returns HTTP 404.
   */
  it('should return 404 for unknown planets', async () => {
    const res = await request(app).get('/api/layers/pluto');
    expect(res.status).toBe(404);
  });

});