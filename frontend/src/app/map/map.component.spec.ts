import { ComponentFixture, fakeAsync, TestBed } from '@angular/core/testing';
import { MapComponent } from './map.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Map from 'ol/Map';

vi.mock('ol/Map', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      on: vi.fn(),
      addLayer: vi.fn(),
      getLayers: vi.fn().mockReturnValue({
        getArray: vi.fn().mockReturnValue([]),
        push: vi.fn()
      }),
      setView: vi.fn().mockReturnValue({
        animate: vi.fn()
      }),
      getView: vi.fn().mockReturnValue({
        animate: vi.fn(),
        getZoom: vi.fn().mockReturnValue(2),
        getCenter: vi.fn().mockReturnValue([0, 0])
      }),
      getTarget: vi.fn().mockReturnValue('mapContainer'),
      setTarget: vi.fn()
    };
  })
}));

// Mock Layer and Source classes used in MapService member initializers
vi.mock('ol/layer/Tile', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      setVisible: vi.fn(),
      setSource: vi.fn(),
      setZIndex: vi.fn(),
      get: vi.fn()
    };
  })
}));

vi.mock('ol/source/OSM', () => ({
  default: vi.fn().mockImplementation(function () { return {}; })
}));

vi.mock('ol/source/XYZ', () => ({
  default: vi.fn().mockImplementation(function () { return {}; })
}));

vi.mock('ol/View', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      getZoom: vi.fn().mockReturnValue(2),
      getCenter: vi.fn().mockReturnValue([0, 0]),
      animate: vi.fn()
    };
  })
}));

vi.mock('ol/control', () => ({
  ScaleLine: vi.fn().mockImplementation(function () { return {}; })
}));

vi.mock('ol/proj', () => ({
  fromLonLat: vi.fn((coords) => coords),
  toLonLat: vi.fn((coords) => coords)
}));

describe('MapComponent', () => {
  let component: MapComponent;
  let fixture: ComponentFixture<MapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapComponent, HttpClientTestingModule],
    }).compileComponents();

    fixture = TestBed.createComponent(MapComponent);
    component = fixture.componentInstance;

    // Manually assign the mock map to the component
    component.mapContainer = {
      nativeElement: document.createElement('div')
    } as any;

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // Async waiting on animation frames
  fakeAsync(() => {
    it('setPlanet updates currentPlanet and animates view', () => {
      const animatedSpy = vi.spyOn(component.mapService.map()!.getView(), 'animate');
      component.mapService.setPlanet('mars');
      expect(component.mapService.currentPlanet()).toBe('mars');
      expect(animatedSpy).toHaveBeenCalled();
    });
  })


  it('creates overlay layer when toggled on', () => {
    const map = component.mapService.map();
    const layerSpy = vi.spyOn(map!, 'addLayer');

    // Ensure the service thinks the layer doesn't exist yet
    vi.spyOn(map!.getLayers(), 'getArray').mockReturnValue([]);

    component.toggleLayer({
      id: 'lroc', // Matches OVERLAY_URLS key
      name: 'LROC',
      type: 'overlay',
      visible: false, // Service will flip this to true
      zIndex: 1
    } as any);

    expect(layerSpy).toHaveBeenCalled();
  });

  it('should handle map initialization', () => {
    const map = component.mapService.map();
    expect(map).toBeDefined();
    expect(map!.getTarget()).toBeDefined();
  });
});
