import {
  Component,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
  inject,
  signal,
  PLATFORM_ID
} from '@angular/core';

import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { MapService, Planet, LayerItem } from '../services/map.service';
import { HttpClient } from '@angular/common/http';
import { take } from 'rxjs/operators';

import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style';

import Papa from 'papaparse';

interface AIResponse {
  name: string;
  lat: number;
  lon: number;
  planet: Planet;
  error?: string;
}

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})
export class MapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('consoleView') private consoleContainer!: ElementRef;
  @ViewChild('terminalInput') set terminalInputRef(el: ElementRef | undefined) {
    if (el) setTimeout(() => el.nativeElement.focus(), 0);
  }

  private http = inject(HttpClient);
  private mapService = inject(MapService);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  public isModalOpen = false;
  public modalMode: 'manual' | 'console' = 'manual';
  public terminalLines = signal<string[]>(['']);
  public terminalInput: string = '';

  public newLayer: {
    name: string;
    type: 'vector' | 'raster';
    source: string;
    color: string;
    visible: boolean;
  } = {
      name: '',
      type: 'vector',
      source: '',
      color: '#ff0000',
      visible: true
    };

  // Expose mapService properties to template
  get currentPlanet() { return this.mapService.currentPlanet(); }
  get layers() { return [...this.mapService.visibleLayers()]; }
  get zoomDisplay() { return this.mapService.zoomDisplay(); }
  get currentLon() { return this.mapService.currentLon(); }
  get currentLat() { return this.mapService.currentLat(); }
  get currentStats() { return this.mapService.getPlanetStats(); }
  get isLoading() { return this.mapService.isLoading(); }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId) || !this.mapContainer?.nativeElement) return;

    const scaleContainer = document.createElement('div');
    scaleContainer.className = 'scale-drag-container';

    this.mapService.initMap(this.mapContainer.nativeElement, scaleContainer);
    this.mapContainer.nativeElement.appendChild(scaleContainer);

    queueMicrotask(() => {
      this.setPlanet('earth');
      this.makeScaleDraggable(scaleContainer);
    });

    this.addFIRMSLayer();

    // Scroll console automatically
    setInterval(() => {
      if (this.consoleContainer) {
        const el = this.consoleContainer.nativeElement;
        el.scrollTop = el.scrollHeight;
      }
    }, 100);
  }

  ngOnDestroy(): void {
    const map = this.mapService.map();
    if (map) map.setTarget(undefined);
  }

  // Exposed methods
  setPlanet(planet: Planet) { this.mapService.setPlanet(planet); this.cdr.detectChanges(); }
  toggleLayer(layer: LayerItem) { this.mapService.toggleLayer(layer); this.cdr.detectChanges(); }

  onLayerDropped(event: CdkDragDrop<LayerItem[]>) {
    const layersCopy = [...this.mapService.planetStates()[this.currentPlanet]];
    moveItemInArray(layersCopy, event.previousIndex, event.currentIndex);
    this.mapService.reorderLayers(layersCopy);
    this.cdr.detectChanges();
  }

  onAddLayer() {
    this.isModalOpen = true;
    this.modalMode = 'console';
    this.bootConsole();
  }

  closeModal() {
    this.isModalOpen = false;
    this.cdr.detectChanges();
  }

  createManualLayer() {
    if (!this.newLayer.name || !this.newLayer.source) {
      alert('Please enter a layer name and source.');
      return;
    }

    const layer: LayerItem = {
      id: this.newLayer.name.toLowerCase().replace(/\s+/g, '-'),
      name: this.newLayer.name,
      description: `User-added ${this.newLayer.type} layer`,
      type: this.newLayer.type,
      visible: this.newLayer.visible,
      zIndex: 999,
      source: this.newLayer.source,
      color: this.newLayer.color
    };

    this.mapService.addLayer(layer, this.currentPlanet);
    this.mapService.refreshLayers(this.currentPlanet);

    this.closeModal();

    this.newLayer = { name: '', type: 'vector', source: '', color: '#ff0000', visible: true };
  }

  private bootConsole() {
    this.terminalLines.set([]);
    ['Initializing GIS Console...', 'Connection established to GIS Server...', 'Ready for commands.']
      .forEach((msg, idx) => {
        setTimeout(() => {
          this.terminalLines.update(prev => [...prev, msg]);
          this.cdr.detectChanges();
        }, idx * 500);
      });
  }

  handleTerminalCommand(event: any) {
    const inputEl = event.target as HTMLInputElement;
    const command = inputEl.value.trim().toLowerCase();
    if (!command) return;

    this.terminalLines.update(prev => [...prev, `> ${command}`, `AI: Analyzing request...`]);

    this.http.get<AIResponse>(`https://gazawayj.pythonanywhere.com/search?q=${command}`)
      .pipe(take(1))
      .subscribe({
        next: (res: AIResponse) => {
          if (res.lat !== undefined && res.lon !== undefined) {
            this.terminalLines.update(prev => [...prev, `AI: Located ${res.name}. Moving...`]);
            this.mapService.flyToLocation(res.lon, res.lat, res.planet);
            setTimeout(() => this.closeModal(), 2000);
          } else {
            this.terminalLines.update(prev => [...prev, `AI: Location not found.`]);
          }
        },
        error: () => {
          this.terminalLines.update(prev => [...prev, `AI: Error connecting to server.`]);
        }
      });

    inputEl.value = '';
  }

  private makeScaleDraggable(el: HTMLElement) {
    let dragging = false, startX = 0, startY = 0;

    el.style.position = 'absolute';
    el.style.bottom = '10px';
    el.style.left = '10px';
    el.style.cursor = 'grab';

    el.addEventListener('pointerdown', e => {
      dragging = true;
      startX = e.clientX - el.offsetLeft;
      startY = e.clientY - el.offsetTop;
      el.setPointerCapture(e.pointerId);
      el.style.cursor = 'grabbing';
      el.style.bottom = 'auto';
    });

    el.addEventListener('pointermove', e => {
      if (!dragging) return;
      el.style.left = `${e.clientX - startX}px`;
      el.style.top = `${e.clientY - startY}px`;
    });

    el.addEventListener('pointerup', () => {
      dragging = false;
      el.style.cursor = 'grab';
    });
  }

  /**
   * Load NASA FIRMS CSV via backend proxy, convert to GeoJSON, add to map
   */
  private addFIRMSLayer() {
  this.http.get('http://localhost:3000/firms', { responseType: 'text' })
    .pipe(take(1))
    .subscribe({
      next: (csvData: string) => {
        const parsed = Papa.parse(csvData, { header: true });

        // Filter valid rows
        const validRows = (parsed.data as any[])
          .filter(row => !isNaN(parseFloat(row.latitude)) && !isNaN(parseFloat(row.longitude)));

        console.log(`FIRMS: Loaded ${validRows.length} valid fire points.`);

        const features = validRows.map(row => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [parseFloat(row.longitude), parseFloat(row.latitude)]
          },
          properties: {
            brightness: row.brightness,
            date: row.acq_date,
            time: row.acq_time,
            confidence: row.confidence,
            satellite: row.satellite
          }
        }));

        const geojson = {
          type: 'FeatureCollection',
          features
        };

        const firesLayer = new VectorLayer({
          source: new VectorSource({
            features: new GeoJSON().readFeatures(geojson, { featureProjection: 'EPSG:3857' })
          }),
          style: new Style({
            image: new CircleStyle({
              radius: 8, // slightly bigger for visibility
              fill: new Fill({ color: 'red' }),
              stroke: new Stroke({ color: '#fff', width: 1 })
            })
          }),
          visible: true
        });

        const map = this.mapService.map();
        if (map) {
          map.addLayer(firesLayer);

          // Fly to the first fire for testing
          if (features.length > 0) {
            const [lon, lat] = features[0].geometry.coordinates;
            this.mapService.flyToLocation(lon, lat, this.currentPlanet);
          }
        } else {
          console.warn('FIRMS: Map object not available yet.');
        }
      },
      error: (err) => {
        console.error('Error loading FIRMS CSV:', err);
      }
    });
}

}
