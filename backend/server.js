import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin: [
    'https://gazawayj.github.io',
    'http://localhost:4200'
  ]
}));

// Your NASA FIRMS Map Key
const FIRMS_MAP_KEY = '8c771d8430508dba8db3afeb34e9ff72';

// Default parameters: world, VIIRS_SNPP_NRT, 1-day range
const DEFAULT_SOURCE = 'VIIRS_SNPP_NRT';
const DEFAULT_AREA = 'world';
const DEFAULT_RANGE = '1';

// Cache configuration
const CACHE_DIR = path.join(__dirname, 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'firms.csv');
let lastFetchTs = 0;
const CACHE_INTERVAL = 1000 * 60 * 60; // 1 hour

// Ensure cache folder exists
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', ts: Date.now() });
});

// FIRMS endpoint with caching
app.get('/firms', async (req, res) => {
  try {
    const now = Date.now();

    // If cache is older than interval or missing, fetch new data
    if (!fs.existsSync(CACHE_FILE) || now - lastFetchTs > CACHE_INTERVAL) {
      const source = req.query.source || DEFAULT_SOURCE;
      const area = req.query.area || DEFAULT_AREA;
      const range = req.query.range || DEFAULT_RANGE;

      const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_MAP_KEY}/${source}/${area}/${range}`;
      console.log('Fetching FIRMS from NASA:', url);

      const response = await fetch(url);
      if (!response.ok) throw new Error('NASA FIRMS API fetch failed');

      const text = await response.text();
      fs.writeFileSync(CACHE_FILE, text);
      lastFetchTs = now;
      console.log('FIRMS cache updated.');
    } else {
      console.log('Serving FIRMS from cache.');
    }

    // Serve cached file
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(CACHE_FILE);
  } catch (err) {
    console.error('Error serving FIRMS:', err);
    res.status(500).send({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Backend running at http://localhost:${port}`);
});
