// frontend/src/app/map/map.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { MapComponent } from './map.component';
import { LayerManagerService } from './services/layer-manager.service';
import { MapFacadeService } from './services/map-facade.service';

// ============================
// Inline test version of MapComponent
// ============================
import { Component, ElementRef, ViewChild, AfterViewInit } from '@angular/core';

@Component({
  selector: 'app-map',
  standalone: true,
  template: '<div #mapContainer></div>', // minimal inline template
  styles: [] // empty styles
})
class MapComponentTestWrapper extends MapComponent implements AfterViewInit {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;
}

describe('MapComponent', () => {
  let component: MapComponentTestWrapper;
  let fixture: any;
  let layerManager: LayerManagerService;
  let mapFacade: MapFacadeService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapComponentTestWrapper],
      providers: [LayerManagerService, MapFacadeService]
    }).compileComponents();

    fixture = TestBed.createComponent(MapComponentTestWrapper);
    component = fixture.componentInstance;

    layerManager = TestBed.inject(LayerManagerService);
    mapFacade = TestBed.inject(MapFacadeService);

    // Mock mapFacade map to prevent real OpenLayers creation
    mapFacade.map = {
      addLayer: jest.fn(),
      removeLayer: jest.fn(),
      getView: () => ({ setCenter: jest.fn(), setZoom: jest.fn() }),
      on: jest.fn()
    } as any;

    // Prevent real HTTP requests in LayerManager
    jest.spyOn(layerManager, 'loadLayerFromSource').mockImplementation(() => true);
    jest.spyOn(layerManager, 'loadPlanet').mockImplementation(() => {});

    fixture.detectChanges();
  });

  it('should initialize default properties', () => {
    expect(component.currentPlanet).toBe('earth');
    expect(component.zoomDisplay).toBe('2');
    expect(component.currentLon).toBe(0);
    expect(component.currentLat).toBe(0);
    expect(component.lonLabel).toBe('Lon');
    expect(component.latLabel).toBe('Lat');
  });

  it('should switch planet and update baseLayer', () => {
    const spyLoadPlanet = jest.spyOn(layerManager, 'loadPlanet');
    component.setPlanet('mars');
    expect(component.currentPlanet).toBe('mars');
    expect(spyLoadPlanet).toHaveBeenCalledWith('mars');
    expect(component.lonLabel).toBe('M-Longitude');
    expect(component.latLabel).toBe('M-Latitude');
  });

  it('should open and close modal', () => {
    component.openModal();
    expect(component['overlayRef']).toBeDefined();
    component.closeModal();
    expect(component['overlayRef']?.hasAttached()).toBe(false);
  });

  it('should create a manual layer', () => {
    component.newLayerName = 'Test Layer';
    component.fileContent = 'latitude,longitude\n10,20';
    const spyAdd = jest.spyOn(layerManager, 'addManualLayer');
    component.confirmAddLayer();
    expect(spyAdd).toHaveBeenCalledWith(
      component.currentPlanet,
      'Test Layer',
      '',
      'latitude,longitude\n10,20',
      'CSV',
      'latitude',
      'longitude'
    );
  });

  it('should format longitude and latitude correctly', () => {
    component.currentLon = 45.123456;
    component.currentLat = -12.654321;
    expect(component.formattedLon).toBe('45.1235° E');
    expect(component.formattedLat).toBe('12.6543° S');

    component.currentLon = -75.9876;
    component.currentLat = 30.1234;
    expect(component.formattedLon).toBe('75.9876° W');
    expect(component.formattedLat).toBe('30.1234° N');
  });
});
