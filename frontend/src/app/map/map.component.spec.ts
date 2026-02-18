// map.component.spec.ts
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MapComponent } from './map.component';
import { HttpClient } from '@angular/common/http';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { vi, describe, beforeEach, it, expect } from 'vitest';

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
const mockHttp = { get: vi.fn() } as unknown as HttpClient;

// =====================
// Mock services used by MapComponent
// =====================
const mockMapFacade = {
  initMap: vi.fn(),
  trackPointer: vi.fn((callback: any) => {}),
  setPlanet: vi.fn(),
  map: {
    addLayer: vi.fn(),
    removeLayer: vi.fn()
  }
};

const mockLayerManager = {
  attachMap: vi.fn(),
  loadPlanet: vi.fn(),
  toggle: vi.fn(),
  remove: vi.fn(),
  reorderLayers: vi.fn(),
  addManualLayer: vi.fn(),
  addLayerFromConsole: vi.fn(),
  loadLayerFromSource: vi.fn(),
  updateStyle: vi.fn(),
  styleService: {
    getRandomStyleProps: vi.fn(() => ({ color: '#000', shape: 'circle' })),
    getStyle: vi.fn()
  },
  layers: [],
  loadingLayers$: { value: [], subscribe: vi.fn() }
};

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

// =====================
// Tests
// =====================
describe('MapComponent', () => {
  let fixture: ComponentFixture<MapComponent>;
  let component: MapComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapComponent],
      providers: [
        { provide: HttpClient, useValue: mockHttp },
        { provide: 'MapFacadeService', useValue: mockMapFacade },
        { provide: 'LayerManagerService', useValue: mockLayerManager }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .overrideComponent(MapComponent, {
      set: { template: '<div></div>', styles: [''] }
    })
    .compileComponents();

    fixture = TestBed.createComponent(MapComponent);
    component = fixture.componentInstance;

    // Mock mapContainer for AfterViewInit
    (component as any).mapContainer = { nativeElement: {} };

    // Mock OL layers and other internal fields
    (component as any).baseLayer = new MockTileLayer();
    (component as any).layerMap = {};
    (component as any).layers = [];
    (component as any).previewLayer = null;

    // Mock mapFacade and layerManager references
    (component as any).mapFacade = mockMapFacade;
    (component as any).layerManager = mockLayerManager;
  });

  it('should initialize default properties', () => {
    expect(component.isLoading).toBe(false);
    expect(component.currentPlanet).toBe('earth');
    expect((component as any).layers.length).toBe(0);
  });

  it('should switch planet and update baseLayer', () => {
    component.setPlanet('moon');
    expect(component.currentPlanet).toBe('moon');
    expect(mockMapFacade.setPlanet).toHaveBeenCalledWith('moon');

    component.setPlanet('mars');
    expect(component.currentPlanet).toBe('mars');
    expect(mockMapFacade.setPlanet).toHaveBeenCalledWith('mars');
  });

  it('should open and close modal', () => {
    // Mock overlay methods to avoid actual DOM
    (component as any).overlayRef = { attach: vi.fn(), backdropClick: () => ({ subscribe: vi.fn() }), dispose: vi.fn() };
    component.onAddLayer();
    expect(component.modalMode).toBe('manual');

    component.cancelAddLayer();
    expect((component as any).previewLayer).toBeNull();
    expect(component.newLayerName).toBe('');
  });

  it('should create a manual layer', () => {
    component.newLayerName = 'TestLayer';
    component.fileContent = 'mock csv content';
    (component as any).previewLayer = { olLayer: {} };

    // Mock mapFacade map methods
    (component as any).mapFacade.map.addLayer = vi.fn();
    (component as any).mapFacade.map.removeLayer = vi.fn();

    component.confirmAddLayer();

    expect(mockLayerManager.addManualLayer).toHaveBeenCalledWith(
      component.currentPlanet,
      'TestLayer',
      '',
      'mock csv content',
      'CSV',
      component.latField,
      component.lonField
    );

    expect((component as any).previewLayer).toBeNull();
  });

  it('should format longitude and latitude correctly', () => {
    (component as any).currentLon = -45;
    (component as any).currentLat = 30;

    expect(component.formattedLon).toBe('45.0000° W');
    expect(component.formattedLat).toBe('30.0000° N');
  });
});
