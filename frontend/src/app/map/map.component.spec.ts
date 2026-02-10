// map.component.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MapComponent, Layer } from './map.component';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';

// Minimal mock for ElementRef
class MockElementRef {
  nativeElement = document.createElement('div');
}

// Mock for HttpClient
const mockHttpClient = {
  get: vi.fn()
};

describe('MapComponent', () => {
  let component: MapComponent;

  beforeEach(() => {
    component = new MapComponent(
      { run: (fn: Function) => fn() } as any, // NgZone mock
      { detectChanges: () => {} } as any,     // ChangeDetectorRef mock
      mockHttpClient as unknown as HttpClient
    );

    // Provide map container
    component.mapContainer = new MockElementRef() as any;

    // Mock baseLayer methods to avoid OL errors
    component.baseLayer = {
      setSource: vi.fn(),
      setVisible: vi.fn(),
      setZIndex: vi.fn()
    } as any;

    component.layers = [
      { name: 'Basemap', type: 'basemap', source: 'base', visible: true } as Layer
    ];
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize map with base layer', () => {
    component['initializeMap']();
    expect(component.map).toBeDefined();
    expect(component.baseLayer).toBeDefined();
    expect(component.layers[0].name).toBe('Basemap');
  });

  it('should switch planet and update stats labels', () => {
    component.setPlanet('moon');
    expect(component.currentPlanet).toBe('moon');
    expect(component.currentStats.lonLabel).toBe('Selenographic Longitude');
    expect(component.currentStats.latLabel).toBe('Selenographic Latitude');
    expect(component.currentStats.gravity).toBe(1.62);

    component.setPlanet('mars');
    expect(component.currentPlanet).toBe('mars');
    expect(component.currentStats.lonLabel).toBe('Ares Longitude');
    expect(component.currentStats.latLabel).toBe('Ares Latitude');
    expect(component.currentStats.gravity).toBe(3.71);
  });

  it('should toggle layer visibility', () => {
    const layer: Layer = { name: 'Test Layer', type: 'vector', source: 'src', visible: true };
    component.layerMap[layer.name] = { setVisible: vi.fn(), setZIndex: vi.fn() } as any;
    component.layers.push(layer);

    component.toggleLayer(layer);
    expect(layer.visible).toBe(false);
    component.toggleLayer(layer);
    expect(layer.visible).toBe(true);
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
      type: 'vector',
      source: 'src',
      visible: true,
      color: 'green'
    };
    component.map = { addLayer: vi.fn() } as any;

    component.createManualLayer();

    expect(component.layers.find(l => l.name === 'Manual')).toBeDefined();
    expect(component.newLayer.name).toBe('');
  });

  it('should handle terminal command', () => {
    const event = { target: { value: 'test' } } as unknown as Event;
    component.handleTerminalCommand(event);
    expect(component.terminalLines[0]).toBe('> test');
  });

  it('should reorder layers with drag and drop', () => {
    const layer1: Layer = { name: 'A', type: 'vector', source: 'a', visible: true };
    const layer2: Layer = { name: 'B', type: 'vector', source: 'b', visible: true };
    component.layers = [layer1, layer2];
    component.map = { addLayer: vi.fn() } as any;
    component.layerMap = { 'A': { setZIndex: vi.fn(), setVisible: vi.fn() }, 'B': { setZIndex: vi.fn(), setVisible: vi.fn() } } as any;

    component.onLayerDropped({ previousIndex: 0, currentIndex: 1 });

    expect(component.layers[0].name).toBe('B');
    expect(component.layers[1].name).toBe('A');
  });

  it('should format longitude and latitude correctly', () => {
    const lon = component.formatCoord(-45, 'lon');
    expect(lon).toBe('45.00° W / 315.00° E');

    const lat = component.formatCoord(-30, 'lat');
    expect(lat).toBe('30.00° S');
  });
});
