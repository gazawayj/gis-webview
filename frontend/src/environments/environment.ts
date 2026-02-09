// src/environments/environment.ts
export const environment = {
  production: false,
  backendUrl: window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'https://gis-webview.onrender.com'
};
