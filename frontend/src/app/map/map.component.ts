// src/app/map/map.component.ts
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';

import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { defaults as defaultControls } from 'ol/control';
import { fromLonLat } from 'ol/proj';
import { EventsKey } from 'ol/events';

type Planet = 'earth' | 'moon' | 'mars';

interface Layer {
  name: string;
  type: 'vector' | 'raster';
  source: string;
  visible: boolean;
  color?: string;
  description?: string;
}

interface PlanetStats {
  gravity: number;
  lonLabel: string;
  latLabel: string;
}

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})
export class MapComponent implements OnInit {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('consoleView', { static: false }) consoleView?: ElementRef<HTMLDivElement>;

  map!: Map;
  baseLayer!: TileLayer<XYZ>;
  layers: Layer[] = [];
  isLoading = true;

  currentPlanet: Planet = 'earth';
  currentLon = 0;
  currentLat = 0;
  zoomDisplay = 2;

  currentStats: PlanetStats = {
    gravity: 9.81,
    lonLabel: 'Lon',
    latLabel: 'Lat'
  };

  isModalOpen = false;
  modalMode: 'manual' | 'console' = 'manual';

  newLayer: Layer = {
    name: '',
    type: 'vector',
    source: '',
    visible: true
  };

  terminalLines: string[] = [];

  private zoomListener?: EventsKey;

  private readonly BASEMAP_URLS: Record<Planet, string> = {
    earth: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    mars: 'https://mars-gis.netlify.app/tiles/{z}/{x}/{y}.png',
    moon: 'https://moon-gis.netlify.app/tiles/{z}/{x}/{y}.png'
  };

  ngOnInit(): void {
    this.initializeMap();
    this.isLoading = false;
  }

  private initializeMap(): void {
    this.baseLayer = new TileLayer({
      source: new XYZ({ url: this.BASEMAP_URLS[this.currentPlanet] })
    });

    this.map = new Map({
      target: this.mapContainer.nativeElement,
      layers: [this.baseLayer],
      view: new View({
        center: fromLonLat([0, 0]),
        zoom: 2
      }),
      controls: defaultControls()
    });

    const view = this.map.getView();

    view.on('change:center', () => {
      const center = view.getCenter();
      if (center) {
        this.currentLon = center[0];
        this.currentLat = center[1];
      }
    });

    this.zoomListener = view.on('change:resolution', () => {
      const zoom = view.getZoom();
      this.zoomDisplay = zoom !== undefined ? zoom : 2;
    });
  }

  setPlanet(planet: Planet): void {
    if (planet === this.currentPlanet) return;

    this.currentPlanet = planet;

    switch (planet) {
      case 'earth': this.currentStats.gravity = 9.81; break;
      case 'moon': this.currentStats.gravity = 1.62; break;
      case 'mars': this.currentStats.gravity = 3.71; break;
    }

    this.baseLayer.setSource(new XYZ({ url: this.BASEMAP_URLS[planet] }));
  }

  toggleLayer(layer: Layer): void {
    layer.visible = !layer.visible;
  }

  onAddLayer(): void {
    this.isModalOpen = true;
    this.modalMode = 'manual';
  }

  createManualLayer(): void {
    if (this.newLayer.name && this.newLayer.source) {
      this.layers.push({ ...this.newLayer });
      this.newLayer = { name: '', type: 'vector', source: '', visible: true };
      this.closeModal();
    }
  }

  closeModal(): void {
    this.isModalOpen = false;
  }

  handleTerminalCommand(evt: Event): void {
    const keyboardEvent = evt as KeyboardEvent;
    const inputEl = keyboardEvent.target as HTMLInputElement;
    const command = inputEl.value.trim();
    if (!command) return;

    this.terminalLines.push(`> ${command}`);
    inputEl.value = '';
  }

  onLayerDropped(event: any): void {
    const movedLayer = this.layers.splice(event.previousIndex, 1)[0];
    this.layers.splice(event.currentIndex, 0, movedLayer);
  }

  terminalLinesList(): string[] {
    return this.terminalLines;
  }
}
