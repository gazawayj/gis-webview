// map.component.spec.ts
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MapComponent, Layer } from './map.component';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { By } from '@angular/platform-browser';

// =====================
// Mock OpenLayers layers
// =====================
class MockTileLayer {
  visible = true;
  zIndex = 0;
  setSource() {}
  setVisible(v: boolean) { this.visible = v; }
  setZIndex(z: number) { this.zIndex = v; }
}

class MockVectorLayer extends MockTileLayer {
  source: any;
  style: any;
}

// =====================
// Mock HttpClient
// =====================
const mockHttp = {
  get: vi.createSpy('get')
} as unknown as HttpClient;

// =====================
// Mock PapaParse
// =====================
jest.mock('papaparse', () => ({
  parse: jest.fn((csv: string, options: any) => ({
    data: [
      { latitude: '10', longitude: '20', brightness: '300', acq_date: '2026-02-10', acq_time: '1200', confidence: 'high', satellite: 'T1' }
    ]
  }))
}));

describe('MapComponent', () => {
  let fixture: ComponentFixture<MapComponent>;
  let component: MapComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MapComponent],
      providers: [
        { provide: HttpClient, useValue: mockHttp }
      ],
      schemas: [NO_ERRORS_SCHEMA] // Ignore template errors for OL map container
    }).compileComponents();

    fixture = TestBed.createComponent(MapComponent);
    component = fixture.componentInstance;

    // Mock map container
    component.mapContainer = { nativeElement: {} } as any;

    // Prevent real map initialization
    component.initializeMap = jasmine.createSpy('initializeMap');
    component.reorderMapLayers = jasmine.createSpy('reorderMapLayers');

    // Mock OL layers
    component.baseLayer = new MockTileLayer() as any;
    component.layerMap = {};
  });

  it('should initialize default properties', () => {
    expect(component.isLoading).toBeTrue();
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
    expect(layer.visible).toBeFalse();
    expect(olLayer.visible).toBeFalse();

    component.toggleLayer(layer);
    expect(layer.visible).toBeTrue();
    expect(olLayer.visible).toBeTrue();
  });

  it('should open and close modal', () => {
    component.onAddLayer();
    expect(component.isModalOpen).toBeTrue();
    expect(component.modalMode).toBe('manual');

    component.closeModal();
    expect(component.isModalOpen).toBeFalse();
  });

  it('should create a manual layer', () => {
    component.newLayer = { name: 'MyLayer', type: 'vector', source: 'src', visible: true };
    component.map = { addLayer: jasmine.createSpy('addLayer') } as any;

    component.createManualLayer();
    expect(component.layers.find(l => l.name === 'MyLayer')).toBeDefined();
    expect(component.newLayer.name).toBe('');
    expect(component.isModalOpen).toBeFalse();
  });

  it('should handle terminal command', () => {
    component.terminalLines = [];
    const event = { target: { value: 'hello' } } as any;
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
    mockHttp.get = jasmine.createSpy('get').and.returnValue(of('dummy csv content'));
    component.map = { addLayer: jasmine.createSpy('addLayer') } as any;

    component.addFIRMSLayer();

    expect(mockHttp.get).toHaveBeenCalled();
    const layer = component.layers.find(l => l.name === 'Current Fires (FIRMS)');
    expect(layer).toBeDefined();
    expect(layer?.visible).toBeFalse();
  });
});
