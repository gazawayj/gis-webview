import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

dotenv.config();

// Fix __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache directory for FIRMS CSV
const CACHE_DIR = path.join(__dirname, 'cache');

// Ensure cache directory exists
await fs.mkdir(CACHE_DIR, { recursive: true });

const app = express();
const port = process.env.PORT || 3000;

// CORS allowed origins
app.use(cors({
  origin: [
    'https://gazawayj.github.io',
    'http://localhost:4200'
  ]
}));

// NASA FIRMS Map Key
const FIRMS_MAP_KEY = '8c771d8430508dba8db3afeb34e9ff72';

// Default FIRMS params
const DEFAULT_SOURCE = 'VIIRS_SNPP_NRT';
const DEFAULT_AREA = 'world';
const DEFAULT_RANGE = '1';

// Cache duration in milliseconds (24 hours)
const CACHE_DURATION = 24 * 60 * 60 * 1000;

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', ts: Date.now() });
});

// FIRMS endpoint with caching
app.get('/firms', async (req, res) => {
  try {
    const source = req.query.source || DEFAULT_SOURCE;
    const area = req.query.area || DEFAULT_AREA;
    const range = req.query.range || DEFAULT_RANGE;

    const cacheFile = path.join(CACHE_DIR, `${source}-${area}-${range}.csv`);

    let useCache = false;

    try {
      const stats = await fs.stat(cacheFile);
      const age = Date.now() - stats.mtimeMs;
      if (age < CACHE_DURATION) useCache = true;
    } catch {
      // Cache doesn't exist, will fetch
    }

    if (useCache) {
      const cachedData = await fs.readFile(cacheFile, 'utf8');
      res.setHeader('Content-Type', 'text/csv');
      return res.send(cachedData);
    }

    // Fetch from NASA FIRMS
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_MAP_KEY}/${source}/${area}/${range}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('NASA FIRMS API fetch failed');

    const text = await response.text();

    // Save to cache
    await fs.writeFile(cacheFile, text, 'utf8');

    res.setHeader('Content-Type', 'text/csv');
    res.send(text);
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Backend running at http://localhost:${port}`);
});
