// map.component.spec.ts
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MapComponent, LayerConfig } from './map.component';
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
} as unknown as HttpClient;

// =====================
// Mock PapaParse
// =====================
vi.mock('papaparse', () => ({
  default: {
    parse: vi.fn((csv: string, options: any) => ({
      data: [
        { latitude: '10', longitude: '20', brightness: '300', acq_date: '2026-02-10', acq_time: '1200', confidence: 'high', satellite: 'T1' }
      ]
    }))
  }
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

    // Mock OL layers
    component.baseLayer = new MockTileLayer() as any;
    component.layerMap = {};
  });

  it('should initialize default properties', () => {
    expect(component.isLoading).toBe(false);
    expect(component.currentPlanet).toBe('earth');
    expect(component.layers.length).toBe(0);
  });

  it('should switch planet and update baseLayer', () => {
    const oldSource = component.baseLayer.setSource;
    component.setPlanet('moon');
    expect(component.currentPlanet).toBe('moon');
    expect(component.baseLayer.setSource).toBeDefined();

    component.setPlanet('mars');
    expect(component.currentPlanet).toBe('mars');
  });

  it('should open and close modal', () => {
    component.onAddLayer();
    expect(component.showAddLayerModal).toBe(true);

    component.cancelAddLayer();
    expect(component.showAddLayerModal).toBe(false);
  });

  it('should create a manual layer', () => {
    component.newLayerName = 'MyLayer';
    component.newLayerDescription = 'desc';
    component.map = { addLayer: vi.fn() } as any;

    component.confirmAddLayer();

    const added = component.layers.find(l => l.name === 'MyLayer');
    expect(added).toBeDefined();
    expect(component.showAddLayerModal).toBe(false);
  });

  it('should format longitude and latitude correctly', () => {
    (component as any).currentLon = -45;
    (component as any).currentLat = 30;
    expect(component.formattedLon).toBe('45.0000° W');
    expect(component.formattedLat).toBe('30.0000° N');
  });
});
