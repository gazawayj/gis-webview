import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { DragDropModule } from '@angular/cdk/drag-drop';

// Import standalone components
import { AppComponent } from './app.component';
import { MapComponent } from './map/map.component';

@NgModule({
  imports: [
    BrowserModule,
    FormsModule,
    BrowserAnimationsModule,
    DragDropModule,
    AppComponent,
    MapComponent
  ],
  bootstrap: [AppComponent] // only bootstrap the root AppComponent
})
export class AppModule {}
