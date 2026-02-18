// backend/src/server.spec.ts
import request from 'supertest';
import express from 'express';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

let app: express.Express;

// Mock fetch globally to avoid hitting NASA FIRMS API in CI
vi.mock('node-fetch', async () => {
  const actual: any = await vi.importActual('node-fetch');
  return {
    ...actual,
    default: vi.fn(async () => ({
      ok: true,
      text: async () => 'latitude,longitude,brightness\n10,20,300',
    })),
  };
});

describe('Backend API Endpoints', () => {
  beforeAll(() => {
    dotenv.config();

    app = express();
    app.use(cors({ origin: ['https://gazawayj.github.io', 'http://localhost:4200'] }));

    const FIRMS_MAP_KEY = '8c771d8430508dba8db3afeb34e9ff72';
    const DEFAULT_SOURCE = 'VIIRS_SNPP_NRT';
    const DEFAULT_AREA = 'world';
    const DEFAULT_RANGE = '1';

    app.get('/health', (req, res) => {
      res.status(200).json({ status: 'ok', ts: Date.now() });
    });

    app.get('/firms', async (req, res) => {
      try {
        const source = req.query.source || DEFAULT_SOURCE;
        const area = req.query.area || DEFAULT_AREA;
        const range = req.query.range || DEFAULT_RANGE;

        const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_MAP_KEY}/${source}/${area}/${range}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error('NASA FIRMS API fetch failed');

        const text = await response.text();
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send(text);
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: (err as Error).message });
      }
    });
  });

  it('GET /health should return status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /firms should return CSV with header', async () => {
    const res = await request(app).get('/firms');
    expect(res.status).toBe(200);
    expect(res.text).toContain('latitude,longitude,brightness'); // CSV header
  });
});
