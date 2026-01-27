import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MapComponent } from './map.component';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('MapComponent', () => {
  let component: MapComponent;
  let fixture: ComponentFixture<MapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(MapComponent);
    component = fixture.componentInstance;

    // Initialize the internal private objects that setPlanet expects
    component['baseLayer'] = {
      setSource: vi.fn(),
      setVisible: vi.fn()
    } as any;

    component['map'] = {
      getView: vi.fn(() => ({
        setCenter: vi.fn(),
        setZoom: vi.fn()
      })),
      removeLayer: vi.fn(),
      addLayer: vi.fn()
    } as any;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('setPlanet updates currentPlanet', () => {
    // Stub the helper method to prevent 'new TileArcGISRest' from running
    vi.spyOn(component as any, 'getBasemapSource').mockReturnValue({});

    component.setPlanet('mars');

    expect(component.currentPlanet).toBe('mars');
    // Verify that baseLayer (which was the undefined culprit) was called
    expect(component['baseLayer'].setSource).toHaveBeenCalled();
  });

  it('creates overlay layer when toggled on', () => {
    // 1. Create a "fake" OpenLayers source that won't crash the Layer constructor
    const mockSource = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      getProjection: vi.fn(() => ({ getCode: () => 'EPSG:4326' })),
      getState: vi.fn(() => 'ready'),
    };

    // 2. Stub the helper method to return our fake source
    vi.spyOn(component as any, 'getOverlaySource').mockReturnValue(mockSource);

    component.toggleLayer({
      id: 'lroc',
      name: 'LROC',
      description: 'test',
      visible: true,
      type: 'overlay'
    });

    // 3. Assertions
    expect(component['overlayLayers']['lroc']).toBeDefined();
    expect(component['map'].addLayer).toHaveBeenCalled();
  });

});
