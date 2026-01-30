import { Component, AfterViewInit, ViewChild, ElementRef, Inject, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PLATFORM_ID } from '@angular/core';
import { toLonLat } from 'ol/proj';
import { MapService, Planet, LayerItem } from '../services/map';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})
export class MapComponent implements AfterViewInit {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  mapService = inject(MapService);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  // UI-only properties
  public zoomDisplay: string = '2.0';
  public currentLon: string = '0.00°';
  public currentLat: string = '0.00°';
  map: any;

  // These help the template find data in the service
  get currentPlanet() { return this.mapService.currentPlanet(); }
  get isLoading() { return this.mapService.isLoading(); }
  get layers() {
    // Sort descending by zIndex: 1 (Overlay) first, 0 (Basemap) last
    return this.mapService.visibleLayers().sort((a, b) => b.zIndex - a.zIndex);
  }
  get currentStats() {
    return this.mapService.getPlanetStats();
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Create container for ScaleLine
    const scaleContainer = document.createElement('div');
    scaleContainer.className = 'scale-drag-container';

    // Initialize Map via Service
    const map = this.mapService.initMap(this.mapContainer.nativeElement, scaleContainer);
    this.mapContainer.nativeElement.appendChild(scaleContainer);

    // Event Listeners for UI updates
    map.on('moveend', () => {
      const zoom = map.getView().getZoom();
      this.zoomDisplay = zoom ? zoom.toFixed(1) : '2.0';
      this.cdr.detectChanges();
    });

    map.on('pointermove', (evt) => {
      if (evt.coordinate) {
        const lonLat = toLonLat(evt.coordinate);
        this.currentLon = `${lonLat[0].toFixed(2)}°`;
        this.currentLat = `${lonLat[1].toFixed(2)}°`;
        this.cdr.detectChanges();
      }
    });

    // Initial Planet Setup
    queueMicrotask(() => {
      this.setPlanet('earth');
      this.makeScaleDraggable(scaleContainer);
    });
  }

  setPlanet(planet: Planet): void {
    this.mapService.setPlanet(planet);
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
}
