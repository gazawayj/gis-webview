import {
  Component, AfterViewInit, OnDestroy, OnInit, ViewChild, ElementRef,
  ChangeDetectorRef, inject, signal, PLATFORM_ID
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { MapService, Planet, LayerItem } from '../services/map.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment.prod';
import Papa from 'papaparse';

export interface PlanetStats {
  lonLabel: string;
  latLabel: string;
  gravity: number;
  [key: string]: any;
}

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  templateUrl: './map.component.html'
})
export class MapComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('consoleView') private consoleContainer!: ElementRef;
  @ViewChild('terminalInput') set terminalInputRef(el: ElementRef | undefined) {
    if (el) setTimeout(() => el.nativeElement.focus(), 0);
  }

  private http = inject(HttpClient);
  private mapService = inject(MapService);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  public planets: Planet[] = ['earth', 'mars', 'moon'];
  public isModalOpen = false;
  public modalMode: 'manual' | 'console' = 'manual';
  public terminalInput = '';
  public terminalLines = signal<string[]>([]);

  public newLayer = { name: '', type: 'vector' as const, source: '', color: '#ff0000', visible: true };

  get currentPlanet() { return this.mapService.currentPlanet(); }
  get layers() { return [...this.mapService.planetStats()[this.currentPlanet]]; }
  get zoomDisplay() { return this.mapService.zoomDisplay(); }
  get currentLon() { return this.mapService.currentLon(); }
  get currentLat() { return this.mapService.currentLat(); }
  get isLoading() { return this.mapService.isLoading(); }

  // Provide stats for template
  get currentStats(): PlanetStats {
    switch (this.currentPlanet) {
      case 'earth': return { lonLabel: 'Longitude', latLabel: 'Latitude', gravity: 9.81 };
      case 'mars': return { lonLabel: 'Longitude', latLabel: 'Latitude', gravity: 3.721 };
      case 'moon': return { lonLabel: 'Longitude', latLabel: 'Latitude', gravity: 1.622 };
      default: return { lonLabel: '', latLabel: '', gravity: 0 };
    }
  }

  ngOnInit() { this.pingBackend(0); }

  private pingBackend(retries: number) {
    const MAX_RETRIES = 5, RETRY_DELAY = 3000;
    this.http.get(`${environment.backendUrl}/health`, { responseType: 'text' }).pipe()
      .subscribe({
        next: () => console.log('Backend awake ✅', environment.backendUrl),
        error: () => {
          if (retries < MAX_RETRIES) setTimeout(() => this.pingBackend(retries + 1), RETRY_DELAY);
          else console.error('Backend failed to respond.');
        }
      });
  }

  ngAfterViewInit() {
    if (!isPlatformBrowser(this.platformId) || !this.mapContainer?.nativeElement) return;

    const scaleContainer = document.createElement('div');
    scaleContainer.className = 'scale-drag-container';

    this.mapService.initMap(this.mapContainer.nativeElement, scaleContainer);
    this.mapContainer.nativeElement.appendChild(scaleContainer);

    queueMicrotask(() => {
      this.setPlanet('earth');
      this.makeScaleDraggable(scaleContainer);
    });

    setInterval(() => {
      if (this.consoleContainer) this.consoleContainer.nativeElement.scrollTop = this.consoleContainer.nativeElement.scrollHeight;
    }, 100);
  }

  ngOnDestroy() {
    const map = this.mapService.map();
    if (map) map.setTarget(undefined);
  }

  setPlanet(planet: Planet) { this.mapService.setPlanet(planet); this.cdr.detectChanges(); }

  toggleLayer(layer: LayerItem) { this.mapService.toggleLayer(layer); }

  // ---------------- Drag & Drop ----------------
  onLayerDropped(event: CdkDragDrop<LayerItem[]>) {
    const planetLayers = [...this.mapService.planetStats()[this.currentPlanet]];
    moveItemInArray(planetLayers, event.previousIndex, event.currentIndex);
    this.mapService.reorderLayersFromArray(planetLayers);
    this.cdr.detectChanges();
  }

  // ---------------- Modal ----------------
  onAddLayer() { this.isModalOpen = true; this.modalMode = 'manual'; }
  closeModal() { this.isModalOpen = false; this.cdr.detectChanges(); }
  submitLayerModal() { this.createManualLayer(); }

  createManualLayer() {
    if (!this.newLayer.name || !this.newLayer.source) { alert('Enter name and source.'); return; }
    this.mapService.createManualLayer(this.newLayer);
    this.newLayer = { name: '', type: 'vector', source: '', color: '#ff0000', visible: true };
    this.closeModal();
  }

  // ---------------- Terminal ----------------
  handleTerminalCommand(event: Event) {
    const keyboardEvent = event as KeyboardEvent;
    const inputEl = keyboardEvent.target as HTMLInputElement;
    const command = inputEl.value.trim();
    if (!command) return;

    this.terminalLines.update(prev => [...prev, `> ${command}`]);
    inputEl.value = '';
  }

  // ---------------- Utilities ----------------
  private makeScaleDraggable(el: HTMLElement) {
    let dragging = false, startX = 0, startY = 0;
    el.style.position = 'absolute'; el.style.bottom = '10px'; el.style.left = '10px'; el.style.cursor = 'grab';

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
}
