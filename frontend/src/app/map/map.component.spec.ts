import 'zone.js/testing'; // <--- MUST BE LINE 1
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { MapComponent } from './map.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { MapService } from '../services/map.service';
import { vi, expect } from 'vitest'; // ONLY import vi and expect

// --- Mocks (Using 'function' to act as constructors) ---
const mockMapInstance = {
  on: vi.fn(),
  addLayer: vi.fn(),
  removeLayer: vi.fn(),
  getLayers: vi.fn().mockReturnValue({
    getArray: vi.fn().mockReturnValue([]),
    push: vi.fn()
  }),
  setView: vi.fn(),
  getView: vi.fn().mockReturnValue({
    animate: vi.fn(),
    getZoom: vi.fn().mockReturnValue(2),
    getCenter: vi.fn().mockReturnValue([0, 0]),
    getProjection: vi.fn().mockReturnValue({ getCode: () => 'EPSG:3857' })
  }),
  getTarget: vi.fn().mockReturnValue('mapContainer'),
  setTarget: vi.fn()
};

vi.mock('ol/Map', () => ({ default: function() { return mockMapInstance; } }));
vi.mock('ol/View', () => ({ default: function() { return mockMapInstance.getView(); } }));
vi.mock('ol/layer/Tile', () => ({ default: function() { return { setVisible: vi.fn(), setSource: vi.fn(), setZIndex: vi.fn(), get: vi.fn() }; } }));
vi.mock('ol/layer/Vector', () => ({ default: function() { return { setVisible: vi.fn(), setSource: vi.fn(), setZIndex: vi.fn() }; } }));
vi.mock('ol/source/OSM', () => ({ default: function() { return {}; } }));
vi.mock('ol/source/XYZ', () => ({ default: function() { return {}; } }));
vi.mock('ol/source/Vector', () => ({ default: function() { return {}; } }));
vi.mock('ol/control', () => ({ ScaleLine: function() { return {}; } }));
vi.mock('ol/proj', () => ({ fromLonLat: vi.fn((c) => c), toLonLat: vi.fn((c) => c), register: vi.fn() }));
vi.mock('ol/format/GeoJSON', () => ({ default: function() { return { readFeatures: vi.fn().mockReturnValue([]) }; } }));

// --- Test Suite ---
describe('MapComponent', () => {
  let component: MapComponent;
  let fixture: ComponentFixture<MapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapComponent, HttpClientTestingModule],
      providers: [MapService]
    }).compileComponents();

    fixture = TestBed.createComponent(MapComponent);
    component = fixture.componentInstance;
    component.mapContainer = { nativeElement: document.createElement('div') } as any;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('setPlanet updates currentPlanet and animates view', async () => {
  const mapService = TestBed.inject(MapService);
  const mapInstance = mapService.map();
  
  // Ensure we are spying on the correct view object
  const view = mapInstance!.getView();
  const animatedSpy = vi.spyOn(view, 'animate');

  // Trigger the change
  mapService.setPlanet('mars');
  
  // Manually trigger Angular's change detection cycle
  fixture.detectChanges();
  
  // Wait for any asynchronous tasks (like the view update) to complete
  await fixture.whenStable();

  expect(mapService.currentPlanet()).toBe('mars');
  expect(animatedSpy).toHaveBeenCalled();
});

  it('creates overlay layer when toggled on', async () => {
    const mapService = TestBed.inject(MapService);
    const toggleSpy = vi.spyOn(mapService, 'toggleLayer');

    const toggleBtn = fixture.debugElement.query(By.css('input[type="checkbox"]')) || 
                      fixture.debugElement.query(By.css('#layer-toggle'));

    if (!toggleBtn) throw new Error('Toggle button not found');

    toggleBtn.nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(toggleSpy).toHaveBeenCalled();
  });

  it('should handle map initialization', () => {
    const map = component['mapService'].map();
    expect(map).toBeDefined();
    expect(map!.getTarget()).toBe('mapContainer');
  });
});
