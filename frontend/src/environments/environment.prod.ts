// src/environments/environment.prod.ts
export const environment = {
  production: true,
  backendUrl: window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'https://gis-webview.onrender.com'
};
