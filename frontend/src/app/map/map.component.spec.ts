// map.component.spec.ts
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { MapComponent } from './map.component';
import type { Layer } from './map.component';

describe('MapComponent', () => {
  let component: MapComponent;

  // Mocks
  const fakeZone = { run: (fn: any) => fn() } as any;
  const fakeCdr = { detectChanges: () => {} } as any;
  const fakeHttp = {
    get: vi.fn().mockReturnValue(of('latitude,longitude\n0,0\n'))
  } as any;

  beforeEach(() => {
    component = new MapComponent(fakeZone, fakeCdr, fakeHttp);

    // Mock map container
    component.mapContainer = { nativeElement: {} } as any;

    // Prevent real OpenLayers initialization
    component.initializeMap = () => {};
    component.reorderMapLayers = () => {};
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should set initial planet to earth and stats', () => {
    expect(component.currentPlanet).toBe('earth');
    component.updateStatsLabels();
    expect(component.currentStats.gravity).toBe(9.81);
    expect(component.currentStats.lonLabel).toBe('Longitude');
    expect(component.currentStats.latLabel).toBe('Latitude');
  });

  it('should switch planet and update stats labels', () => {
    component.setPlanet('moon');
    expect(component.currentPlanet).toBe('moon');
    expect(component.currentStats.gravity).toBe(1.62);
    expect(component.currentStats.lonLabel).toBe('Selenographic Longitude');
    expect(component.currentStats.latLabel).toBe('Selenographic Latitude');

    component.setPlanet('mars');
    expect(component.currentStats.gravity).toBe(3.71);
    expect(component.currentStats.lonLabel).toBe('Ares Longitude');
    expect(component.currentStats.latLabel).toBe('Ares Latitude');
  });

  it('should toggle layer visibility', () => {
    const layer: Layer = {
      name: 'Test Layer',
      type: 'vector',
      source: 'source',
      visible: true
    };
    component.layerMap[layer.name] = { setVisible: vi.fn(), setZIndex: vi.fn() } as any;
    component.layers.push(layer);

    component.toggleLayer(layer);
    expect(layer.visible).toBe(false);
  });

  it('should open and close modal', () => {
    component.onAddLayer();
    expect(component.isModalOpen).toBe(true);
    component.closeModal();
    expect(component.isModalOpen).toBe(false);
  });

  it('should create a manual layer', () => {
    component.newLayer = {
      name: 'Manual',
      type: 'vector',
      source: 'src',
      visible: true
    };

    component.map = { addLayer: vi.fn() } as any;
    component.createManualLayer();

    expect(component.layers.find((l: { name: string; }) => l.name === 'Manual')).toBeTruthy();
    expect(component.newLayer.name).toBe('');
  });

  it('should handle terminal command', () => {
    const input = { value: 'test' } as any;
    component.handleTerminalCommand({ target: input } as any);
    expect(component.terminalLines[0]).toContain('test');
    expect(input.value).toBe('');
  });

  it('should format longitude and latitude correctly', () => {
    const lon = component.formatCoord(10, 'lon');
    const lat = component.formatCoord(-45, 'lat');
    expect(lon).toContain('E');
    expect(lat).toContain('S');
  });

  it('should normalize longitude correctly', () => {
    const result = component.normalizeLon(-90);
    expect(result.west).toBe(90);
    expect(result.east).toBe(270);
  });
});
