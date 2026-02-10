// src/app/map/map.component.spec.ts
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { MapComponent, Layer, Planet } from './map.component';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';

describe('MapComponent', () => {
  let component: MapComponent;
  let httpMock: Partial<HttpClient>;

  beforeEach(() => {
    // Mock HttpClient
    httpMock = {
      get: vi.fn().mockReturnValue(of('latitude,longitude,brightness,acq_date,acq_time,confidence,satellite\n10,20,300,2026-02-10,1200,high,A'))
    };

    component = new MapComponent(
      { run: (fn: any) => fn() } as any, // Mock NgZone
      { detectChanges: () => {} } as any, // Mock ChangeDetectorRef
      httpMock as HttpClient
    );

    // Mock the map container
    component.mapContainer = {
      nativeElement: {} as HTMLDivElement
    } as any;

    // Prevent OL from failing in test
    component.initializeMap = () => {};
    component.reorderMapLayers = () => {};
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize layers array with basemap', () => {
    const planet: Planet = 'earth';
    component.currentPlanet = planet;
    component.layers = [
      {
        name: 'Basemap',
        type: 'basemap' as const,
        source: component.BASEMAP_URLS[planet],
        visible: true
      }
    ];
    expect(component.layers.length).toBe(1);
    expect(component.layers[0].type).toBe('basemap');
  });

  it('should switch planet and update stats labels', () => {
    component.currentPlanet = 'earth';
    component.setPlanet('moon');
    expect(component.currentPlanet).toBe('moon');
    expect(component.currentStats.gravity).toBe(1.62);
    expect(component.currentStats.lonLabel).toBe('Selenographic Longitude');
    expect(component.currentStats.latLabel).toBe('Selenographic Latitude');
  });

  it('should toggle layer visibility', () => {
    const layer: Layer = {
      name: 'Test Layer',
      type: 'vector' as const,
      source: 'test.csv',
      visible: true
    };
    component.layerMap[layer.name] = {
      setVisible: vi.fn(),
      setZIndex: vi.fn()
    } as any;

    component.layers = [layer];
    component.toggleLayer(layer);
    expect(layer.visible).toBe(false);
    expect(component.layerMap[layer.name].setVisible).toHaveBeenCalledWith(false);
  });

  it('should open and close modal', () => {
    component.onAddLayer();
    expect(component.isModalOpen).toBe(true);
    expect(component.modalMode).toBe('manual');

    component.closeModal();
    expect(component.isModalOpen).toBe(false);
  });

  it('should create a manual layer', () => {
    component.newLayer = {
      name: 'Manual',
      type: 'vector' as const,
      source: 'manual.csv',
      visible: true,
      color: 'green'
    };
    component.map = { addLayer: vi.fn() } as any;
    component.layerMap = {};

    component.createManualLayer();

    expect(component.layers.find(l => l.name === 'Manual')).toBeTruthy();
    expect(component.newLayer.name).toBe('');
    expect(component.map.addLayer).toHaveBeenCalled();
  });

  it('should handle terminal command', () => {
    const input = { value: 'test' } as HTMLInputElement;
    component.handleTerminalCommand({ target: input } as any);
    expect(component.terminalLines.includes('> test')).toBe(true);
    expect(input.value).toBe('');
  });

  it('should format longitude and latitude correctly', () => {
    const lon = -75;
    const lat = 40;

    const lonStr = component.formatCoord(lon, 'lon');
    const latStr = component.formatCoord(lat, 'lat');

    expect(lonStr).toMatch(/° W \/ \d+\.?\d*° E/);
    expect(latStr).toBe('40.00° N');
  });

  it('should normalize longitude correctly', () => {
    const neg = component.normalizeLon(-45);
    expect(neg.west).toBe(45);
    expect(neg.east).toBe(315);

    const pos = component.normalizeLon(100);
    expect(pos.east).toBe(100);
    expect(pos.west).toBe(260);
  });
});
