import {
  Component,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  Inject,
  ChangeDetectorRef,
  inject,
  signal,
  PLATFORM_ID,
} from '@angular/core';

import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import proj4 from 'proj4';
import { register } from 'ol/proj/proj4';

import {
  DragDropModule,
  CdkDropList,
  CdkDragPlaceholder,
  CdkDragDrop,
  CdkDragMove,
  CdkDrag,
  moveItemInArray
} from '@angular/cdk/drag-drop';

import { MapService, Planet, LayerItem } from '../services/map';
import { HttpClient, provideHttpClient } from '@angular/common/http';

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
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    CdkDrag,
    CdkDropList,
    CdkDragPlaceholder
  ],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})
export class MapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('consoleView') private consoleContainer!: ElementRef;
  @ViewChild('terminalInput') set terminalInputRef(el: ElementRef | undefined) {
    if (el) {
      setTimeout(() => el.nativeElement.focus(), 0);
    }
  }

  // ========== MAP DATA GETTERS ==========
  get zoomDisplay() { return this.mapService.zoomDisplay(); }
  get currentLon() { return this.mapService.currentLon(); }
  get currentLat() { return this.mapService.currentLat(); }
  get currentLayersArray(): LayerItem[] {
    const planet = this.mapService.currentPlanet();
    return [...this.mapService.planetStates()[planet]];
  }

  public terminalLines = signal<string[]>(['']);
  public terminalInput: string = '';

  // ========== MODAL STATE ==========
  public isModalOpen = false;
  public activeTab: 'console' | 'manual' = 'console';
  public consoleValue: string = '';
  public manualValue: string = '';

  public newLayer: {
    name: string;
    type: 'vector' | 'raster';
    source: string;
    color?: string;
    visible: boolean;
  } = {
    name: '',
    type: 'vector',
    source: '',
    color: '#ff0000',
    visible: true
  };

  private http = inject(HttpClient);
  private mapService = inject(MapService);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  // ========== GETTERS FOR TEMPLATE ==========
  get currentPlanet() { return this.mapService.currentPlanet(); }
  get isLoading() { return this.mapService.isLoading(); }
  get layers() { return this.mapService.visibleLayers(); }
  get currentStats() { return this.mapService.getPlanetStats(); }
  get mapServiceInstance() { return this.mapService; }

  // ================= MODAL METHODS =================
  openModal(tab: 'console' | 'manual' = 'console') {
    this.activeTab = tab;
    this.isModalOpen = true;
    this.bootConsole();
  }

  closeModal() {
    this.isModalOpen = false;
    this.consoleValue = '';
    this.manualValue = '';
    this.cdr.detectChanges();
  }

  submitModal() {
    if (this.activeTab === 'console') {
      console.log('Console input:', this.consoleValue);
    } else {
      console.log('Manual input:', this.manualValue);
    }
    this.closeModal();
  }

  // ================= LAYER METHODS =================
  onAddLayer(): void {
    this.openModal('manual'); // Open manual tab by default for new layers
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
    this.closeModal();

    this.newLayer = {
      name: '',
      type: 'vector',
      source: '',
      color: '#ff0000',
      visible: true
    };
  }

  private bootConsole(): void {
    this.terminalLines.set([]);
    const bootMessages = [
      'Initializing GIS Console...',
      'Connection established to GIS Server...',
      'Ready for commands.'
    ];
    bootMessages.forEach((msg, index) => {
      setTimeout(() => {
        this.terminalLines.update(prev => [...prev, msg]);
        this.cdr.detectChanges();
      }, index * 500);
    });
  }

  onLayerMoved(event: CdkDragMove<any>): void {
    const layers = this.currentLayersArray;
    const visualIndex = event.pointerPosition.y;
  }

  onLayerDropped(event: CdkDragDrop<LayerItem[]>): void {
    const currentPlanet = this.mapService.currentPlanet();
    const layers = [...this.mapService.planetStates()[currentPlanet]];
    moveItemInArray(layers, event.previousIndex, event.currentIndex);
    this.mapService.reorderLayers(layers);
    this.cdr.detectChanges();
  }

  toggleLayer(layer: LayerItem): void {
    this.mapService.toggleLayer(layer);
    this.cdr.detectChanges();
  }

  public setPlanet(planet: Planet): void {
    this.mapService.setPlanet(planet);
    this.cdr.detectChanges();
  }

  // ================= SCALE DRAG =================
  private makeScaleDraggable(el: HTMLElement): void {
    let dragging = false;
    let startX = 0, startY = 0;

    el.style.position = 'absolute';
    el.style.bottom = '10px';
    el.style.left = '10px';
    el.style.cursor = 'grab';

    el.addEventListener('pointerdown', (e) => {
      dragging = true;
      startX = e.clientX - el.offsetLeft;
      startY = e.clientY - el.offsetTop;
      el.setPointerCapture(e.pointerId);
      el.style.cursor = 'grabbing';
      el.style.bottom = 'auto';
    });

    el.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      el.style.left = `${e.clientX - startX}px`;
      el.style.top = `${e.clientY - startY}px`;
    });

    el.addEventListener('pointerup', () => {
      dragging = false;
      el.style.cursor = 'grab';
    });
  }

  // ================= TERMINAL =================
  handleTerminalCommand(event: any): void {
    const inputEl = event.target as HTMLInputElement;
    const command = inputEl.value.trim().toLowerCase();
    if (!command) return;

    this.terminalLines.update(prev => [...prev, `> ${command}`]);
    this.terminalLines.update(prev => [...prev, `AI: Analyzing request...`]);

    this.http.get<AIResponse>(`https://gazawayj.pythonanywhere.com/search?q=${command}`).subscribe({
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

  // ================= LIFECYCLE =================
  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.mapContainer || !this.mapContainer.nativeElement) return;

    const scaleContainer = document.createElement('div');
    scaleContainer.className = 'scale-drag-container';
    this.mapService.initMap(this.mapContainer.nativeElement, scaleContainer);
    this.mapContainer.nativeElement.appendChild(scaleContainer);

    queueMicrotask(() => {
      this.setPlanet('earth');
      this.makeScaleDraggable(scaleContainer);
    });

    const scrollInterval = setInterval(() => {
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
}
