import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MapComponent } from './map.component';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

// Mock OpenLayers classes
class MockMap {
  addLayer = vi.fn();
  getView = vi.fn(() => ({
    setCenter: vi.fn(),
    setZoom: vi.fn(),
    getCenter: vi.fn(() => [0, 0])
  }));
  getLayers = vi.fn(() => ({
    getArray: vi.fn(() => []),
  }));
}

class MockTileLayer {
  constructor(public options?: any) {}
  setVisible = vi.fn();
  getVisible = vi.fn(() => this.options?.visible ?? true);
}

class MockXYZ {
  constructor(public options?: any) {}
}

vi.mock('ol/Map', () => ({
  __esModule: true,
  default: MockMap
}));

vi.mock('ol/layer/Tile', () => ({
  __esModule: true,
  default: MockTileLayer
}));

vi.mock('ol/source/XYZ', () => ({
  __esModule: true,
  default: MockXYZ
}));

describe('MapComponent', () => {
  let component: MapComponent;
  let fixture: ComponentFixture<MapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapComponent, CommonModule, FormsModule, DragDropModule]
    }).compileComponents();

    fixture = TestBed.createComponent(MapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize map with base layer', () => {
    expect(component.map).toBeDefined();
    expect(component.baseLayer).toBeDefined();
    expect(component.layers.length).toBeGreaterThan(0);
    expect(component.layers[0].type).toBe('basemap');
  });

  it('should switch planet and update stats labels', () => {
    component.setPlanet('moon');
    expect(component.currentPlanet).toBe('moon');
    expect(component.currentStats.lonLabel).toBe('Selenographic Longitude');
    expect(component.currentStats.gravity).toBe(1.62);

    component.setPlanet('mars');
    expect(component.currentPlanet).toBe('mars');
    expect(component.currentStats.lonLabel).toBe('Ares Longitude');
    expect(component.currentStats.gravity).toBe(3.71);
  });

  it('should toggle layer visibility', () => {
    const layer = component.layers[0];
    expect(layer.visible).toBe(true);

    component.toggleLayer(layer);
    expect(layer.visible).toBe(false);
    expect(component.baseLayer.getVisible()).toBe(false);

    component.toggleLayer(layer);
    expect(layer.visible).toBe(true);
    expect(component.baseLayer.getVisible()).toBe(true);
  });

  it('should open and close modal', () => {
    component.onAddLayer();
    expect(component.isModalOpen).toBe(true);
    expect(component.modalMode).toBe('manual');

    component.closeModal();
    expect(component.isModalOpen).toBe(false);
  });

  it('should create a manual layer', () => {
    component.onAddLayer();
    component.newLayer = { name: 'Test Layer', type: 'vector', source: 'http://test', visible: true };
    const initialLength = component.layers.length;

    component.createManualLayer();

    expect(component.layers.length).toBe(initialLength + 1);
    expect(component.layers[component.layers.length - 1].name).toBe('Test Layer');
    expect(component.isModalOpen).toBe(false);
  });

  it('should format longitude and latitude correctly', () => {
    const lon = -75;
    const lat = 40;

    const formattedLon = component.formatCoord(lon, 'lon');
    const formattedLat = component.formatCoord(lat, 'lat');

    expect(formattedLon).toContain('W');
    expect(formattedLat).toContain('N');

    const latS = -10;
    expect(component.formatCoord(latS, 'lat')).toContain('S');
  });

  it('should handle terminal command', () => {
    const input = { target: { value: 'echo test' } } as any;
    const initialLines = component.terminalLines.length;

    component.handleTerminalCommand(input);

    expect(component.terminalLines.length).toBe(initialLines + 1);
    expect(component.terminalLines[component.terminalLines.length - 1]).toContain('echo test');
    expect(input.target.value).toBe('');
  });

  it('should reorder layers with drag and drop', () => {
    component.layers = [
      { name: 'Layer1', type: 'vector', source: '', visible: true },
      { name: 'Layer2', type: 'vector', source: '', visible: true },
      { name: 'Layer3', type: 'vector', source: '', visible: true }
    ];

    const event = { previousIndex: 0, currentIndex: 2 };
    component.onLayerDropped(event);

    expect(component.layers[2].name).toBe('Layer1');
    expect(component.layers[0].name).toBe('Layer2');
    expect(component.layers[1].name).toBe('Layer3');
  });
});
