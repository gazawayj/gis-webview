// map.component.spec.ts
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MapComponent } from './map.component';
import { HttpClient } from '@angular/common/http';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { MapFacadeService } from './services/map-facade.service';
import { LayerManagerService, LayerConfig, ShapeType } from './services/layer-manager.service';

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
// Typed mock MapFacadeService
// =====================
const mockMapFacade: Partial<MapFacadeService> = {
  initMap: vi.fn(),
  trackPointer: vi.fn((cb: (lon: number, lat: number, zoom: number) => void) => {}),
  setPlanet: vi.fn(),
  map: {
    addLayer: vi.fn(),
    removeLayer: vi.fn()
  } as any
};

// =====================
// Typed mock LayerManagerService
// =====================
const mockLayerManager: Partial<LayerManagerService> = {
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
  } as any,
  layers: [] as LayerConfig[],
  loadingLayers$: { value: [], subscribe: vi.fn() } as any
};

// =====================
// Extended MapComponent type for test
// =====================
type TestableMapComponent = MapComponent & {
  baseLayer: MockTileLayer;
  layerMap: Record<string, any>;
  previewLayer: LayerConfig | null;
};

// =====================
// Tests
// =====================
describe('MapComponent', () => {
  let fixture: ComponentFixture<MapComponent>;
  let component: TestableMapComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapComponent],
      providers: [
        { provide: HttpClient, useValue: {} },
        { provide: MapFacadeService, useValue: mockMapFacade },
        { provide: LayerManagerService, useValue: mockLayerManager }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .overrideComponent(MapComponent, {
      set: { template: '<div></div>', styles: [''] }
    })
    .compileComponents();

    fixture = TestBed.createComponent(MapComponent);
    component = fixture.componentInstance as TestableMapComponent;

    // Mock mapContainer for AfterViewInit
    component.mapContainer = { nativeElement: {} } as any;

    // Initialize internal properties for testing
    component.baseLayer = new MockTileLayer();
    component.layerMap = {};
    component.previewLayer = null;
    (component as any).layerManager = mockLayerManager as LayerManagerService;
    (component as any).mapFacade = mockMapFacade as MapFacadeService;
  });

  it('should initialize default properties', () => {
    expect(component.isLoading).toBe(false);
    expect(component.currentPlanet).toBe('earth');
    expect(component.zoomDisplay).toBe('2');
    expect(component.lonLabel).toBe('Lon');
    expect(component.latLabel).toBe('Lat');
    expect((component as any).layerManager.layers.length).toBe(0);
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
    // Mock overlayRef to avoid actual DOM
    component['overlayRef'] = { attach: vi.fn(), backdropClick: () => ({ subscribe: vi.fn() }), dispose: vi.fn() } as any;

    component.onAddLayer();
    expect(component.modalMode).toBe('manual');

    component.cancelAddLayer();
    expect(component.previewLayer).toBeNull();
    expect(component.newLayerName).toBe('');
  });

  it('should create a manual layer', () => {
    component.newLayerName = 'TestLayer';
    component.fileContent = 'mock csv content';
    component.previewLayer = { olLayer: {} } as any;

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
    expect(component.previewLayer).toBeNull();
  });

  it('should format longitude and latitude correctly', () => {
    component.currentLon = -45;
    component.currentLat = 30;
    expect(component.formattedLon).toBe('45.0000° W');
    expect(component.formattedLat).toBe('30.0000° N');
  });
});
