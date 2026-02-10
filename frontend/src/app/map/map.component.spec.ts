import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MapComponent } from './map.component';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';

// Mock OpenLayers classes
class MockMap {
  addLayer = vi.fn();
  getView = vi.fn(() => ({
    setCenter: vi.fn(),
    setZoom: vi.fn(),
    getCenter: vi.fn(() => [0, 0])
  }));
}

class MockTileLayer {
  constructor(public options?: any) {}
  setVisible = vi.fn();
  getVisible = vi.fn(() => this.options?.visible ?? true);
  setZIndex = vi.fn();
}

class MockVectorLayer {
  constructor(public options?: any) {}
  setVisible = vi.fn();
  getVisible = vi.fn(() => this.options?.visible ?? true);
  setZIndex = vi.fn();
}

class MockXYZ {
  constructor(public options?: any) {}
}

vi.mock('ol/Map', () => ({ __esModule: true, default: MockMap }));
vi.mock('ol/layer/Tile', () => ({ __esModule: true, default: MockTileLayer }));
vi.mock('ol/layer/Vector', () => ({ __esModule: true, default: MockVectorLayer }));
vi.mock('ol/source/XYZ', () => ({ __esModule: true, default: MockXYZ }));

describe('MapComponent', () => {
  let component: MapComponent;
  let fixture: ComponentFixture<MapComponent>;
  let httpMock: { get: any };

  beforeEach(async () => {
    httpMock = { get: vi.fn(() => of(`latitude,longitude,brightness,acq_date,acq_time,confidence,satellite
34.5,-118.2,300,2026-02-10,1230,80,A
35.2,-117.9,280,2026-02-10,1240,90,B`)) };

    await TestBed.configureTestingModule({
      imports: [MapComponent, CommonModule, FormsModule, DragDropModule],
      providers: [{ provide: HttpClient, useValue: httpMock }]
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
    expect(component.baseLayer.setVisible).toHaveBeenCalledWith(false);

    component.toggleLayer(layer);
    expect(layer.visible).toBe(true);
    expect(component.baseLayer.setVisible).toHaveBeenCalledWith(true);
  });

  it('should load FIRMS layer and add to layers', () => {
    // Trigger FIRMS loading
    component.addFIRMSLayer();

    expect(httpMock.get).toHaveBeenCalledWith('https://gis-webview.onrender.com/firms', { responseType: 'text' });

    // LayerMap should contain FIRMS
    const layerNames = Object.keys(component.layerMap);
    expect(layerNames).toContain('Current Fires (FIRMS)');

    // Layers panel should include FIRMS
    const firmsLayer = component.layers.find(l => l.name === 'Current Fires (FIRMS)');
    expect(firmsLayer).toBeDefined();
    expect(firmsLayer?.visible).toBe(false); // starts hidden
  });

  it('should toggle FIRMS layer visibility', () => {
    component.addFIRMSLayer();
    const firms = component.layers.find(l => l.name === 'Current Fires (FIRMS)')!;
    firms.visible = false;

    component.toggleLayer(firms);
    expect(firms.visible).toBe(true);
    expect(component.firmsLayer.setVisible).toHaveBeenCalledWith(true);
  });

  it('should create a manual layer', () => {
    component.newLayer = { name: 'Manual1', type: 'vector', source: 'http://test', visible: true };
    component.createManualLayer();

    expect(component.layers.some(l => l.name === 'Manual1')).toBe(true);
    expect(component.layerMap['Manual1']).toBeDefined();
    expect(component.layerMap['Manual1'].setVisible).toHaveBeenCalledWith(true);
  });

  it('should reorder layers correctly', () => {
    // Add manual and FIRMS layers
    component.layers.push(
      { name: 'Manual1', type: 'vector', source: '', visible: true },
      { name: 'Current Fires (FIRMS)', type: 'vector', source: '', visible: true }
    );
    component.layerMap['Manual1'] = new MockVectorLayer();
    component.layerMap['Current Fires (FIRMS)'] = new MockVectorLayer();

    component.reorderMapLayers();

    // Check zIndex assigned in order
    expect(component.baseLayer.setZIndex).toHaveBeenCalledWith(0);
    expect(component.layerMap['Manual1'].setZIndex).toHaveBeenCalledWith(1);
    expect(component.layerMap['Current Fires (FIRMS)'].setZIndex).toHaveBeenCalledWith(2);
  });

  it('should handle drag and drop layer reordering', () => {
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
