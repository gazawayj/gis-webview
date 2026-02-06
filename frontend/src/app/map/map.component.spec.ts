import 'zone.js/testing';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { MapComponent } from './map.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { MapService } from '../services/map.service';
import { vi, expect } from 'vitest';

// Shared mock instance to track calls
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

// CRITICAL: Mocks must be constructors
vi.mock('ol/Map', () => ({
  default: vi.fn().mockImplementation(() => mockMapInstance)
}));

vi.mock('ol/layer/Tile', () => ({
  default: vi.fn().mockImplementation(() => ({
    setVisible: vi.fn(),
    setSource: vi.fn(),
    setZIndex: vi.fn(),
    get: vi.fn()
  }))
}));

vi.mock('ol/layer/Vector', () => ({
  default: vi.fn().mockImplementation(() => ({
    setVisible: vi.fn(),
    setSource: vi.fn(),
    setZIndex: vi.fn()
  }))
}));

vi.mock('ol/View', () => ({
  default: vi.fn().mockImplementation(() => mockMapInstance.getView())
}));

vi.mock('ol/source/OSM', () => ({ default: vi.fn().mockImplementation(() => ({})) }));
vi.mock('ol/source/XYZ', () => ({ default: vi.fn().mockImplementation(() => ({})) }));
vi.mock('ol/source/Vector', () => ({ default: vi.fn().mockImplementation(() => ({})) }));
vi.mock('ol/control', () => ({ ScaleLine: vi.fn().mockImplementation(() => ({})) }));
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
    
    // Ensure the nativeElement exists for initMap
    component.mapContainer = {
      nativeElement: document.createElement('div')
    } as any;
    
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('setPlanet updates currentPlanet and animates view', fakeAsync(() => {
    const mapService = TestBed.inject(MapService);
    const view = mapService.map()!.getView();
    const animatedSpy = vi.spyOn(view, 'animate');

    mapService.setPlanet('mars');
    tick(2000); 

    expect(mapService.currentPlanet()).toBe('mars');
    expect(animatedSpy).toHaveBeenCalled();
  }));

  it('creates overlay layer when toggled on', async () => {
    const mapService = TestBed.inject(MapService);
    const toggleSpy = vi.spyOn(mapService, 'toggleLayer');

    // Use a more generic selector if ID fails
    const toggleBtn = fixture.debugElement.query(By.css('#layer-toggle')) || 
                      fixture.debugElement.query(By.css('input[type="checkbox"]'));

    if (!toggleBtn) throw new Error('Toggle button not found');

    toggleBtn.nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(toggleSpy).toHaveBeenCalled();
  });

  it('should handle map initialization', () => {
    const map = component['mapService'].map();
    expect(map).toBeDefined();
    // Check if the mock was called
    expect(map!.getTarget()).toBe('mapContainer');
  });
});
