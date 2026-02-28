import { enableProdMode, importProvidersFrom } from '@angular/core';
import { environment } from './environments/environment';
import { bootstrapApplication } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { OverlayModule } from '@angular/cdk/overlay';
import { AppComponent } from './app/app.component';
import proj4 from 'proj4';
import { register } from 'ol/proj/proj4';

// Register Mars and Moon IAU codes
proj4.defs('IAU:49900', '+proj=longlat +a=3396190 +b=3376200 +no_defs +type=crs'); // Mars
proj4.defs('IAU:30100', '+proj=longlat +a=1737400 +b=1737400 +no_defs +type=crs'); // Moon
register(proj4);

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(
      BrowserAnimationsModule,
      FormsModule,
      DragDropModule,
      OverlayModule
    )
  ]
}).catch(err => console.error(err));
