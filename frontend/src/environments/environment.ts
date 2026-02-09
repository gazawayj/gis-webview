export const environment = {
  production: false,
  get backendUrl(): string {
    // If running in production (built with --configuration=production), use Render URL
    // Otherwise, default to localhost for dev
    return this.production 
      ? 'https://gis-webview.onrender.com' 
      : 'http://localhost:3000';
  }
};
