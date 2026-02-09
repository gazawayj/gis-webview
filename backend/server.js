import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import cors from 'cors';

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

// Used to wake up free-tier app hosting.
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', ts: Date.now() });
});

app.get('/firms', async (req, res) => {
  try {
    // Optional query params to override defaults
    const source = req.query.source || DEFAULT_SOURCE;
    const area = req.query.area || DEFAULT_AREA;
    const range = req.query.range || DEFAULT_RANGE;

    // NASA FIRMS CSV URL
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_MAP_KEY}/${source}/${area}/${range}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error('NASA FIRMS API fetch failed');

    const text = await response.text();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(text);
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Backend running at http://localhost:${port}`);
});
