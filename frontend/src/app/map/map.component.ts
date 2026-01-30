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
  OnInit,
  PLATFORM_ID
} from '@angular/core';

import { CommonModule, isPlatformBrowser } from '@angular/common';
import proj4 from 'proj4';
import { register } from 'ol/proj/proj4';
import View from 'ol/View';

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

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [
    CommonModule,
    DragDropModule,
    CdkDrag,
    CdkDropList,
    CdkDragPlaceholder
  ],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})
export class MapComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('consoleView') private consoleContainer!: ElementRef;

  get zoomDisplay() { return this.mapService.zoomDisplay(); }
  get currentLon() { return this.mapService.currentLon(); }
  get currentLat() { return this.mapService.currentLat(); }
  get currentLayersArray(): LayerItem[] {
    const planet = this.mapService.currentPlanet();
    return [...this.mapService.planetStates()[planet]];
  }

  public terminalLines = signal<string[]>(['']);
  public terminalInput: string = '';

  mapService = inject(MapService);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);
  public isModalOpen = false;

  // These help the template find data in the service
  get currentPlanet() { return this.mapService.currentPlanet(); }
  get isLoading() { return this.mapService.isLoading(); }
  get layers() {
    // Sort descending by zIndex: 1 (Overlay) first, 0 (Basemap) last
    return this.mapService.visibleLayers();
  }
  get currentStats() {
    return this.mapService.getPlanetStats();
  }

  onAddLayer(): void {
    this.isModalOpen = true;
    //boot the background terminal
    this.bootConsole();
  }

  private bootConsole(): void {
    // Clear any old lines
    this.terminalLines.set([]);

    const bootMessages = [
      'Initializing GIS Console...',
      'Connection established to NASA GIBS...',
      'Ready for commands.'
    ];
    // Add them with a slight delay so they type one after another
    bootMessages.forEach((msg, index) => {
      setTimeout(() => {
        this.terminalLines.update(prev => [...prev, msg]);
        this.cdr.detectChanges();
      }, index * 4000);
    });
  }

  onLayerMoved(event: CdkDragMove<any>): void {
    const layers = this.currentLayersArray;

    // The visual index is derived from how many items are above the current drag item
    const visualIndex = event.pointerPosition.y;
    // Ylogic here to determine the new index based on visualIndex
  }

  // ADD THIS METHOD to fix the TS2339 error
  closeModal(): void {
    this.isModalOpen = false;
    this.cdr.detectChanges(); // Ensure the UI updates immediately
  }



  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.mapContainer || !this.mapContainer.nativeElement) {
      console.error('Map Container element not found.');
      return;
    }

    // Create container for ScaleLine
    const scaleContainer = document.createElement('div');
    scaleContainer.className = 'scale-drag-container';

    // Initialize Map via Service
    this.mapService.initMap(this.mapContainer.nativeElement, scaleContainer);
    this.mapContainer.nativeElement.appendChild(scaleContainer);

    // Initial Planet Setup
    queueMicrotask(() => {
      this.setPlanet('earth');
      this.makeScaleDraggable(scaleContainer);
    });

    // Console boot up
    const scrollInterval = setInterval(() => {
      if (this.consoleContainer) {
        const el = this.consoleContainer.nativeElement;
        el.scrollTop = el.scrollHeight;
      }
    }, 100);
  }

  ngOnDestroy(): void {
    const map = this.mapService.map();
    if (map) {
      map.setTarget(undefined);
    }
  }

  ngOnInit() {
    // Mars (IAU2000:49900)
    proj4.defs('IAU:49900', '+proj=longlat +a=3396190 +b=3376200 +no_defs +type=crs');
    // Moon (IAU2000:30100)
    proj4.defs('IAU:30100', '+proj=longlat +a=1737400 +b=1737400 +no_defs +type=crs');
    // 2. Register them with OpenLayers
    register(proj4);
  }

  onLayerDropped(event: CdkDragDrop<LayerItem[]>): void {
    const currentPlanet = this.mapService.currentPlanet();
    const layers = [...this.mapService.planetStates()[currentPlanet]];

    moveItemInArray(layers, event.previousIndex, event.currentIndex);
    this.mapService.reorderLayers(layers);
    this.cdr.detectChanges();
  }

  public setPlanet(planet: Planet): void {
    this.mapService.setPlanet(planet); // Let the service handle the CRS/View logic
    this.cdr.detectChanges();
  }

  toggleLayer(layer: LayerItem): void {
    this.mapService.toggleLayer(layer);
    this.cdr.detectChanges();
  }

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

  handleTerminalCommand(event: any): void {
    const inputEl = event.target as HTMLInputElement;
    const command = event.target.value.toLowerCase();
    if (!command) return;

    this.terminalLines.update(prev => [...prev, `> ${command}`]);

    // Handle Logic
    if (command.includes('help')) {
      this.terminalLines.update(prev => [...prev, 'Available: earth, mars, moon, clear']);
    } else if (command === 'mars') {
      this.setPlanet('mars');
      this.terminalLines.update(prev => [...prev, 'Switching to Mars CRS (IAU:49900)...']);
    } else if (command === 'clear') {
      this.terminalLines.set([]);
    }

    inputEl.value = '';

    // Single scroll handler
    setTimeout(() => {
      if (this.consoleContainer) {
        const el = this.consoleContainer.nativeElement;
        el.scrollTop = el.scrollHeight;
      }
    }, 50);

    event.target.value = '';
  }
}
