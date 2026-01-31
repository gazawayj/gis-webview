import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { AppComponent } from './app/app';
import { appConfig } from './app/app.config';
import proj4 from 'proj4';
import { register } from 'ol/proj/proj4';

// Register the IAU codes for Mars (MOLA) and Moon (LROC)
proj4.defs('IAU:49900', '+proj=longlat +a=3396190 +b=3376200 +no_defs +type=crs'); // Mars
proj4.defs('IAU:30100', '+proj=longlat +a=1737400 +b=1737400 +no_defs +type=crs'); // Moon

register(proj4);

// Bootstrap the Standalone Application using the correct method
bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient()
  ]
}).catch(err => console.error(err));

