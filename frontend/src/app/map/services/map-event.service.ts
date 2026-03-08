import { Injectable, NgZone, inject } from '@angular/core';
import Map from 'ol/Map';
import Feature from 'ol/Feature';
import { toLonLat } from 'ol/proj';
import { BehaviorSubject } from 'rxjs';

export interface PointerState {
  lon: number;
  lat: number;
  zoom: number;
}

@Injectable({ providedIn: 'root' })
export class MapEventService {
  private zone = inject(NgZone);
  private map!: Map;
  private contextMenuHandler?: () => void;
  
  private pointerStateSubject = new BehaviorSubject<PointerState>({ lon: 0, lat: 0, zoom: 2 });
  private hoverFeatureSubject = new BehaviorSubject<Feature | null>(null);

  pointerState$ = this.pointerStateSubject.asObservable();
  hoverFeature$ = this.hoverFeatureSubject.asObservable();

  attachMap(map: Map) {
    this.map = map;
    this.setupPointerTracking();
    this.setupContextMenu();
  }

  registerContextMenuHandler(handler: () => void) {
    this.contextMenuHandler = handler;
  }

  private setupPointerTracking() {
    const view = this.map.getView();
    
    this.map.on('pointermove', (evt: any) => {
      if (evt.dragging) return;

      const coord = evt.coordinate;
      if (!coord) return;

      this.zone.run(() => {
        const [lon, lat] = toLonLat(coord);
        this.pointerStateSubject.next({
          lon: +lon.toFixed(6),
          lat: +lat.toFixed(6),
          zoom: view.getZoom() ?? 2
        });

        const feature = this.map.forEachFeatureAtPixel(evt.pixel, (f) => f as Feature, {
          hitTolerance: 5,
          layerFilter: (l) => l.getVisible()
        });

        if (this.hoverFeatureSubject.value !== (feature || null)) {
          this.hoverFeatureSubject.next(feature || null);
        }
      });
    });
  }

  private setupContextMenu() {
    const viewport = this.map.getViewport();
    viewport.addEventListener('contextmenu', e => {
      e.preventDefault();
      if (this.contextMenuHandler) {
        this.contextMenuHandler();
      }
    });
  }
}
