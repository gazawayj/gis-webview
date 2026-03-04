import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import csvParse from 'papaparse';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache directory for FIRMS CSV
const CACHE_DIR = path.join(__dirname, 'cache');
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
const FIRMS_MAP_KEY = process.env.FIRMS_MAP_KEY || '8c771d8430508dba8db3afeb34e9ff72';

// Default FIRMS params
const DEFAULT_SOURCE = 'VIIRS_SNPP_NRT';
const DEFAULT_AREA = 'world';
const DEFAULT_RANGE = '1'; // 24-hour rolling window

// Fetch FIRMS CSV from NASA ---
async function fetchFIRMS(source = DEFAULT_SOURCE, area = DEFAULT_AREA, range = DEFAULT_RANGE) {
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_MAP_KEY}/${source}/${area}/${range}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`NASA FIRMS fetch failed: ${response.statusText}`);
  return await response.text();
}

// Merge CSV strings, removing duplicates ---
function mergeCSVs(oldCSV, newCSV) {
  const oldData = csvParse.parse(oldCSV, { header: true }).data;
  const newData = csvParse.parse(newCSV, { header: true }).data;

  const keySet = new Set();
  const merged = [];

  [...oldData, ...newData].forEach(row => {
    const key = `${row.latitude}-${row.longitude}-${row.acq_date}-${row.acq_time}`;
    if (!keySet.has(key)) {
      keySet.add(key);
      merged.push(row);
    }
  });

  return csvParse.unparse(merged);
}

// Update cache for a source/area ---
async function updateCache(source = DEFAULT_SOURCE, area = DEFAULT_AREA) {
  const cacheFile = path.join(CACHE_DIR, `${source}-${area}-24h.csv`);

  try {
    const newCSV = await fetchFIRMS(source, area, DEFAULT_RANGE);
    let finalCSV = newCSV;

    try {
      const oldCSV = await fs.readFile(cacheFile, 'utf8');
      finalCSV = mergeCSVs(oldCSV, newCSV);
    } catch {
      // No previous cache, use newCSV
    }

    await fs.writeFile(cacheFile, finalCSV, 'utf8');
    console.log(`[${new Date().toISOString()}] FIRMS cache updated: ${source}-${area}-24h.csv`);
  } catch (err) {
    console.error(`Failed to update FIRMS cache: ${err.message}`);
  }
}

// Periodically refresh caches
setInterval(() => {
  updateCache(DEFAULT_SOURCE, DEFAULT_AREA);
}, 25 * 60 * 1000); // 25 minutes

// Initial cache update on startup
await updateCache(DEFAULT_SOURCE, DEFAULT_AREA);

// Health check ---
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', ts: Date.now() });
});

// FIRMS endpoint ---
app.get('/firms', async (req, res) => {
  try {
    const source = req.query.source || DEFAULT_SOURCE;
    const area = req.query.area || DEFAULT_AREA;
    const cacheFile = path.join(CACHE_DIR, `${source}-${area}-48h.csv`);

    let csvData = '';
    try {
      csvData = await fs.readFile(cacheFile, 'utf8');
    } catch {
      // If cache missing, fetch on demand
      csvData = await fetchFIRMS(source, area, DEFAULT_RANGE);
      await fs.writeFile(cacheFile, csvData, 'utf8');
    }

    res.setHeader('Content-Type', 'text/csv');
    res.send(csvData);
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: err.message });
  }
});

// Start server ---
app.listen(port, () => {
  console.log(`Backend running at http://localhost:${port}`);
});