export const BASEMAP_URLS: Record<string, string> = {
  earth: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  moon: 'https://moon-gis.netlify.app/tiles/{z}/{x}/{y}.png',
  mars: 'https://mars-gis.netlify.app/tiles/{z}/{x}/{y}.png'
};

export const FIRMS_CSV_URL = 'https://gis-webview.onrender.com/firms';
export const EARTHQUAKE_GEOJSON_URL =
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson';
