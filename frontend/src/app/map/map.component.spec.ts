import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MapComponent } from './map.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Map from 'ol/Map';
import View from 'ol/View';
import VectorLayer from 'ol/layer/Vector';

type Planet = 'earth' | 'mars' | 'moon';

describe('MapComponent', () => {
  let component: MapComponent;
  let fixture: ComponentFixture<MapComponent>;

  // Mock OpenLayers View
  const mockView = {
    getCenter: vi.fn(() => [0, 0]),
    setCenter: vi.fn(),
    getZoom: vi.fn(() => 2),
    setZoom: vi.fn(),
    animate: vi.fn(),
  };

  // Mock OpenLayers Map
  const mockMap = {
    setTarget: vi.fn(),
    getView: vi.fn(() => mockView),
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
    getLayers: vi.fn(() => ({
      getArray: vi.fn(() => []),
      push: vi.fn(),
    })),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapComponent, HttpClientTestingModule],
    }).compileComponents();

    fixture = TestBed.createComponent(MapComponent);
    component = fixture.componentInstance;
    
    // Manually assign the mock map to the component
    component.map = mockMap as unknown as Map;
    
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('setPlanet updates currentPlanet and animates view', () => {
    // This addresses the "view.getCenter is not a function" error
    component.setPlanet('mars');
    expect(component.currentPlanet).toBe('mars');
    expect(mockView.animate).toHaveBeenCalled();
  });

  it('creates overlay layer when toggled on', () => {
    const layerSpy = vi.spyOn(component.map, 'addLayer');
    
    // We pass a mock layer object that matches your Layer interface
    component.toggleLayer({
      id: 'lroc',
      name: 'LROC',
      type: 'overlay',
      visible: true,
      zIndex: 1,
      source: 'tiles' // Add this if your component logic requires it
    } as any);
    
    expect(layerSpy).toHaveBeenCalled();
  });

  it('should handle map initialization', () => {
    expect(mockMap.setTarget).toHaveBeenCalled();
  });
});
