import 'zone.js/testing'; 
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { MapComponent } from './map.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { MapService } from '../services/map.service';

// IMPORT ONLY WHAT IS NOT A GLOBAL
import { vi, expect } from 'vitest'; 
// DO NOT IMPORT: it, describe, beforeEach, afterEach

vi.mock('ol/Map', () => ({
  default: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    addLayer: vi.fn(),
    getLayers: vi.fn().mockReturnValue({
      getArray: vi.fn().mockReturnValue([]),
      push: vi.fn()
    }),
    setView: vi.fn().mockReturnValue({ animate: vi.fn() }),
    getView: vi.fn().mockReturnValue({
      animate: vi.fn(),
      getZoom: vi.fn().mockReturnValue(2),
      getCenter: vi.fn().mockReturnValue([0, 0])
    }),
    getTarget: vi.fn().mockReturnValue('mapContainer'),
    setTarget: vi.fn()
  }))
}));

// (Keep other ol/layer and ol/source mocks exactly as they were...)

describe('MapComponent', () => {
  let component: MapComponent;
  let fixture: ComponentFixture<MapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapComponent, HttpClientTestingModule],
    }).compileComponents();

    fixture = TestBed.createComponent(MapComponent);
    component = fixture.componentInstance;
    component.mapContainer = { nativeElement: document.createElement('div') } as any;
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
    tick(2000); // Advance clock to handle animation

    expect(mapService.currentPlanet()).toBe('mars');
    expect(animatedSpy).toHaveBeenCalled();
  }));

  it('creates overlay layer when toggled on', async () => {
    const mapService = TestBed.inject(MapService);
    const toggleSpy = vi.spyOn(mapService, 'toggleLayer');

    // Robust selector: IDs can be tricky in @for loops
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
    expect(map!.getTarget()).toBeDefined();
  });
});
