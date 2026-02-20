export const BASEMAP_URLS: Record<string, string> = {
  earth: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  moon: 'https://moon-gis.netlify.app/tiles/{z}/{x}/{y}.png',
  mars: 'https://mars-gis.netlify.app/tiles/{z}/{x}/{y}.png'
};

export const PLANETS = {
  earth: { url: BASEMAP_URLS['earth'], radius: 6371008.8 },
  moon:  { url: BASEMAP_URLS['moon'], radius: 1737400 },
  mars:  { url: BASEMAP_URLS['mars'], radius: 3389500 }
};

export const FIRMS_CSV_URL = 'https://gis-webview.onrender.com/firms';
export const EARTHQUAKE_GEOJSON_URL =
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson';
