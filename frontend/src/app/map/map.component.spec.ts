// map.component.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MapComponent, Planet, Layer } from './map.component';
import { of } from 'rxjs';

// =====================
// Mock OL classes
// =====================
class MockTileLayer {
  visible = true;
  zIndex = 0;
  setSource() {}
  setVisible(v: boolean) { this.visible = v; }
  setZIndex(z: number) { this.zIndex = z; }
}

class MockVectorLayer extends MockTileLayer {
  source: any;
  style: any;
}

// =====================
// Mock HttpClient
// =====================
const mockHttp = {
  get: vi.fn()
} as unknown as any;

// =====================
// Mock PapaParse
// =====================
vi.mock('papaparse', () => ({
  parse: vi.fn((csv: string, options: any) => {
    // Return one dummy row regardless of input CSV
    return {
      data: [
        { latitude: '10', longitude: '20', brightness: '300', acq_date: '2026-02-10', acq_time: '1200', confidence: 'high', satellite: 'T1' }
      ]
    };
  })
}));

describe('MapComponent', () => {
  let component: MapComponent;

  beforeEach(() => {
    component = new MapComponent({} as any, {} as any, mockHttp);

    // Mock mapContainer to bypass DOM
    component.mapContainer = { nativeElement: {} } as any;

    // Prevent real map initialization
    component.initializeMap = vi.fn();
    component.reorderMapLayers = vi.fn();

    // Mock OL layers
    component.baseLayer = new MockTileLayer() as any;
    component.layerMap = {};
  });

  it('should initialize default properties', () => {
    expect(component.isLoading).toBe(true);
    expect(component.currentPlanet).toBe('earth');
    expect(component.currentStats.gravity).toBe(9.81);
    expect(component.layers.length).toBe(0);
  });

  it('should switch planet and update stats labels', () => {
    component.setPlanet('moon');
    expect(component.currentPlanet).toBe('moon');
    expect(component.currentStats.lonLabel).toBe('Selenographic Longitude');
    expect(component.currentStats.latLabel).toBe('Selenographic Latitude');
    expect(component.currentStats.gravity).toBe(1.62);

    component.setPlanet('mars');
    expect(component.currentStats.lonLabel).toBe('Ares Longitude');
    expect(component.currentStats.gravity).toBe(3.71);
  });

  it('should toggle layer visibility', () => {
    const layer: Layer = { name: 'Test', type: 'vector', source: '', visible: true };
    const olLayer = new MockVectorLayer() as any;
    component.layerMap[layer.name] = olLayer;

    component.toggleLayer(layer);
    expect(layer.visible).toBe(false);
    expect(olLayer.visible).toBe(false);

    component.toggleLayer(layer);
    expect(layer.visible).toBe(true);
    expect(olLayer.visible).toBe(true);
  });

  it('should open and close modal', () => {
    component.onAddLayer();
    expect(component.isModalOpen).toBe(true);
    expect(component.modalMode).toBe('manual');

    component.closeModal();
    expect(component.isModalOpen).toBe(false);
  });

  it('should create a manual layer', () => {
    component.newLayer = { name: 'MyLayer', type: 'vector', source: 'src', visible: true };
    component.map = { addLayer: vi.fn() } as any;

    component.createManualLayer();
    expect(component.layers.find(l => l.name === 'MyLayer')).toBeDefined();
    expect(component.newLayer.name).toBe('');
    expect(component.isModalOpen).toBe(false);
  });

  it('should handle terminal command', () => {
    const event = { target: { value: 'hello' } } as unknown as Event;
    component.handleTerminalCommand(event);
    expect(component.terminalLines[0]).toContain('hello');
  });

  it('should reorder layers with drag and drop', () => {
    const layerA: Layer = { name: 'A', type: 'vector', source: '', visible: true };
    const layerB: Layer = { name: 'B', type: 'vector', source: '', visible: true };
    component.layers = [layerA, layerB];

    component.onLayerDropped({ previousIndex: 0, currentIndex: 1 });
    expect(component.layers[0].name).toBe('B');
    expect(component.layers[1].name).toBe('A');
  });

  it('should format longitude and latitude correctly', () => {
    const lon = component.formatCoord(-45, 'lon');
    expect(lon).toBe('45.00° W / 315.00° E');

    const lat = component.formatCoord(30, 'lat');
    expect(lat).toBe('30.00° N');
  });

  it('should parse FIRMS CSV and add layer deterministically', () => {
    mockHttp.get = vi.fn().mockReturnValue(of('dummy csv content'));
    component.map = { addLayer: vi.fn() } as any;

    component.addFIRMSLayer();

    expect(mockHttp.get).toHaveBeenCalled();
    const layer = component.layers.find(l => l.name === 'Current Fires (FIRMS)');
    expect(layer).toBeDefined();
    expect(layer?.visible).toBe(false);
  });
});
