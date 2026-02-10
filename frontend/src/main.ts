import { environment } from './environments/environment';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import proj4 from 'proj4';
import { AppModule } from './app/app.module';
import { register } from 'ol/proj/proj4';
import { enableProdMode } from '@angular/core';

// Register the IAU codes for Mars (MOLA) and Moon (LROC)
proj4.defs('IAU:49900', '+proj=longlat +a=3396190 +b=3376200 +no_defs +type=crs'); // Mars
proj4.defs('IAU:30100', '+proj=longlat +a=1737400 +b=1737400 +no_defs +type=crs'); // Moon

register(proj4);

// Bootstrap the Standalone Application using the correct method
if (environment.production) {
  enableProdMode();
}

// Bootstrap the Angular AppModule
platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch(err => console.error(err));

