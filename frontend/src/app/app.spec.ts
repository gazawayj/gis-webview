import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../server'; 

describe('Backend API Endpoints', () => {
  it('GET /api/status should return system health', async () => {
    const res = await request(app).get('/api/status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'online');
  });

  it('GET /api/layers/:planet should return correct planet layers', async () => {
    const res = await request(app).get('/api/layers/mars');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Verify a known Mars layer exists
    expect(res.body[0]).toHaveProperty('id', 'mars-base');
  });

  it('should return 404 for unknown planets', async () => {
    const res = await request(app).get('/api/layers/pluto');
    expect(res.status).toBe(404);
  });
});
