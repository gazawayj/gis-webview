// frontend/src/app/map/map.component.ts
import {
  Component,
  AfterViewInit,
  OnDestroy,
  OnInit,
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
import { environment } from '../../environments/environment';

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
export class MapComponent implements AfterViewInit, OnInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('consoleView') private consoleContainer!: ElementRef;
  @ViewChild('terminalInput') set terminalInputRef(el: ElementRef | undefined) {
    if (el) setTimeout(() => el.nativeElement.focus(), 0);
  }

  // Dependency Injections
  private http = inject(HttpClient);
  public mapService = inject(MapService);
  private cdr = inject(ChangeDetectorRef); // Fixes: Property 'cdr' does not exist
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

  // Getters for template binding
  get currentPlanet() { return this.mapService.currentPlanet(); }
  get layers() { return [...this.mapService.visibleLayers()]; }
  get zoomDisplay() { return this.mapService.zoomDisplay(); }
  get currentLon() { return this.mapService.currentLon(); }
  get currentLat() { return this.mapService.currentLat(); }
  get currentStats() { return this.mapService.getPlanetStats(); }
  get isLoading() { return this.mapService.isLoading(); }

  ngOnInit() {
    this.pingBackend(0);
  }

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

    // Auto-scroll console
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

  setPlanet(planet: Planet) {
    this.mapService.setPlanet(planet);
    this.cdr.detectChanges();
  }

  toggleLayer(layer: LayerItem) {
    this.mapService.toggleLayer(layer);
    this.cdr.detectChanges();
  }

  /**
   * Automatic Z-indexing on Drag & Drop
   */
  onLayerDropped(event: CdkDragDrop<LayerItem[]>) {
    // Fix: Using currentPlanet() as a function call
    const planet = this.mapService.currentPlanet();
    const layersCopy = [...this.mapService.planetStates()[planet]];

    moveItemInArray(layersCopy, event.previousIndex, event.currentIndex);

    // Service handles olLayer.setZIndex() internally
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
      zIndex: 1, // Will be incremented by service
      source: this.newLayer.source,
      color: this.newLayer.color
    };

    this.mapService.addLayer(layer, this.currentPlanet);
    this.closeModal();
    this.newLayer = { name: '', type: 'vector', source: '', color: '#ff0000', visible: true };
    this.cdr.detectChanges();
  }

  /**
   * Load NASA FIRMS CSV, create OL VectorLayer, and register as LayerItem
   */
  private addFIRMSLayer() {
    const url = `${environment.backendUrl}/firms`;

    this.http.get(url, { responseType: 'text' }).pipe(take(1)).subscribe({
      next: (csvData: string) => {
        try {
          const parsed = Papa.parse(csvData, { header: true });
          const validRows = (parsed.data as any[])
            .filter(row => !isNaN(parseFloat(row.latitude)) && !isNaN(parseFloat(row.longitude)));

          if (validRows.length === 0) return;

          const features = validRows.map(row => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [parseFloat(row.longitude), parseFloat(row.latitude)]
            },
            properties: { ...row }
          }));

          const geojson = { type: 'FeatureCollection', features };

          // Create actual OpenLayers Instance
          const firesLayerInstance = new VectorLayer({
            source: new VectorSource({
              features: new GeoJSON().readFeatures(geojson, { featureProjection: 'EPSG:3857' })
            }),
            style: new Style({
              image: new CircleStyle({
                radius: 8,
                fill: new Fill({ color: 'red' }),
                stroke: new Stroke({ color: '#fff', width: 1 })
              })
            }),
            visible: true
          });

          // Wrap in LayerItem to fix Parameter Type Error
          const firmsItem: LayerItem = {
            id: 'firms-layer',
            name: 'NASA FIRMS',
            description: 'Active Fire Points (24h)',
            visible: true,
            type: 'vector',
            zIndex: 10,
            olLayer: firesLayerInstance
          };

          this.mapService.addLayer(firmsItem, 'earth');
          this.cdr.detectChanges();

        } catch (err) {
          console.error('FIRMS parsing error:', err);
        }
      },
      error: () => {
        console.warn(`FIRMS: Backend not ready. Retrying in 5s...`);
        setTimeout(() => this.addFIRMSLayer(), 5000);
      }
    });
  }

  private pingBackend(retries: number) {
    this.http.get(`${environment.backendUrl}/health`, { responseType: 'text' })
      .pipe(take(1)).subscribe({
        next: () => console.log('Backend connected ✅'),
        error: () => retries < 5 && setTimeout(() => this.pingBackend(retries + 1), 3000)
      });
  }

  private bootConsole() {
    this.terminalLines.set([]);
    ['Initializing GIS Console...', 'Ready for commands.'].forEach((msg, idx) => {
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

    this.terminalLines.update(prev => [...prev, `> ${command}`, `AI: Processing...`]);
    this.http.get<AIResponse>(`${environment.backendUrl}/ai`).pipe(take(1)).subscribe({
      next: (res) => {
        if (res.lat !== undefined) {
          this.mapService.flyToLocation(res.lon, res.lat, res.planet);
          setTimeout(() => this.closeModal(), 2000);
        }
      }
    });
    inputEl.value = '';
  }

  private makeScaleDraggable(el: HTMLElement) {
    let dragging = false, startX = 0, startY = 0;
    el.style.position = 'absolute'; el.style.bottom = '10px'; el.style.left = '10px';
    el.addEventListener('pointerdown', e => {
      dragging = true; startX = e.clientX - el.offsetLeft; startY = e.clientY - el.offsetTop;
      el.setPointerCapture(e.pointerId); el.style.bottom = 'auto';
    });
    el.addEventListener('pointermove', e => {
      if (dragging) {
        el.style.left = `${e.clientX - startX}px`;
        el.style.top = `${e.clientY - startY}px`;
      }
    });
    el.addEventListener('pointerup', () => dragging = false);
  }
}
