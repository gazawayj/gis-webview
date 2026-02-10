// map.component.spec.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MapComponent } from './map.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';

// ======================== MOCK OPENLAYERS ========================
const mockSetTarget = vi.fn();
const mockAddLayer = vi.fn();
const mockRemoveLayer = vi.fn();
const mockSetVisible = vi.fn();
const mockSetZIndex = vi.fn();
const mockGetLayers = vi.fn(() => ({ getArray: vi.fn(() => []) }));
const mockUpdateSize = vi.fn();
const mockOn = vi.fn();

vi.mock('ol/Map', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      setTarget: mockSetTarget,
      addLayer: mockAddLayer,
      removeLayer: mockRemoveLayer,
      getLayers: mockGetLayers,
      updateSize: mockUpdateSize,
      on: mockOn,
    })),
  };
});

vi.mock('ol/View', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      setCenter: vi.fn(),
      setZoom: vi.fn(),
      getCenter: vi.fn(() => [0, 0]),
      getZoom: vi.fn(() => 2),
      on: vi.fn(),
    })),
  };
});

vi.mock('ol/layer/Tile', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      setVisible: mockSetVisible,
      setZIndex: mockSetZIndex,
    })),
  };
});

vi.mock('ol/layer/Vector', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      setVisible: mockSetVisible,
      setZIndex: mockSetZIndex,
    })),
  };
});

vi.mock('ol/source/XYZ', () => ({ default: vi.fn() }));
vi.mock('ol/source/Vector', () => ({ default: vi.fn() }));
vi.mock('ol/format/GeoJSON', () => ({ default: vi.fn().mockImplementation(() => ({ readFeatures: vi.fn(() => []) })) }));
vi.mock('ol/style/Style', () => ({ default: vi.fn() }));
vi.mock('ol/style/Circle', () => ({ default: vi.fn() }));
vi.mock('ol/style/Fill', () => ({ default: vi.fn() }));
vi.mock('ol/style/Stroke', () => ({ default: vi.fn() }));
vi.mock('papaparse', () => ({ parse: vi.fn(() => ({ data: [] })) }));

// ======================== TESTS ========================
describe('MapComponent', () => {
  let component: MapComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        MapComponent,
        CommonModule,
        FormsModule,
        DragDropModule,
        HttpClientTestingModule
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(MapComponent);
    component = fixture.componentInstance;

    // Mock the mapContainer element for standalone component
    component.mapContainer = {
      nativeElement: {} as HTMLDivElement
    };
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize map with base layer', () => {
    component.ngOnInit();
    expect(mockSetTarget).toHaveBeenCalled();
    expect(mockAddLayer).toHaveBeenCalled();
  });

  it('should switch planet and update stats labels', () => {
    component.setPlanet('mars');
    expect(component.currentPlanet).toBe('mars');
    expect(component.currentStats.lonLabel).toBe('Ares Longitude');
    expect(component.currentStats.gravity).toBe(3.71);
  });

  it('should toggle layer visibility', () => {
    const layer = { name: 'Test', type: 'vector', visible: true } as any;
    component.layerMap['Test'] = { setVisible: vi.fn(), setZIndex: vi.fn() } as any;
    component.layers.push(layer);
    component.toggleLayer(layer);
    expect(layer.visible).toBe(false);
    expect(component.layerMap['Test'].setVisible).toHaveBeenCalledWith(false);
  });

  it('should open and close modal', () => {
    component.onAddLayer();
    expect(component.isModalOpen).toBe(true);
    expect(component.modalMode).toBe('manual');
    component.closeModal();
    expect(component.isModalOpen).toBe(false);
  });

  it('should create a manual layer', () => {
    component.newLayer = { name: 'Layer1', type: 'vector', source: 'src', visible: true };
    component.map = { addLayer: vi.fn() } as any;
    component.createManualLayer();
    expect(component.layers.some(l => l.name === 'Layer1')).toBe(true);
    expect(component.newLayer.name).toBe('');
  });

  it('should handle terminal command', () => {
    const mockInput = { value: 'cmd' } as HTMLInputElement;
    component.terminalLines = [];
    component.handleTerminalCommand({ target: mockInput } as any);
    expect(component.terminalLines).toContain('> cmd');
    expect(mockInput.value).toBe('');
  });

  it('should reorder layers with drag and drop', () => {
    component.layers = [
      { name: 'A', type: 'basemap', visible: true, source: 'urlA' },
      { name: 'B', type: 'vector', visible: true, source: 'urlB' }
    ];
    component.map = { addLayer: vi.fn() } as any;
    const event = { previousIndex: 0, currentIndex: 1 };
    component.onLayerDropped(event);
    expect(component.layers[0].name).toBe('B');
    expect(component.layers[1].name).toBe('A');
  });

  it('should format longitude and latitude correctly', () => {
    const lon = component.formatCoord(-45, 'lon');
    const lat = component.formatCoord(30, 'lat');
    expect(lon).toContain('W /');
    expect(lat).toContain('N');
  });
});
