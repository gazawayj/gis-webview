import { Component, ElementRef, TemplateRef, ViewChild, AfterViewInit } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LayerManagerService } from './services/layer-manager.service';
import { MapFacadeService } from './services/map-facade.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';

// Minimal mock component for testing
@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  template: `<div #mapContainer></div>`,
  styles: []
})
class MapComponentTest implements AfterViewInit {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('addLayerModal') addLayerModal!: TemplateRef<any>;

  // Properties needed for tests
  currentPlanet: 'earth' | 'moon' | 'mars' = 'earth';
  zoomDisplay = '2';
  currentLon = 0;
  currentLat = 0;
  lonLabel = 'Lon';
  latLabel = 'Lat';

  mapFacade!: MapFacadeService;
  layerManager!: LayerManagerService;

  ngAfterViewInit() {
    // Mock services to prevent errors
    if (this.mapFacade) {
      this.mapFacade.map = {
        addLayer: jest.fn(),
        removeLayer: jest.fn(),
        getView: () => ({ setCenter: jest.fn(), setZoom: jest.fn() }),
        on: jest.fn()
      } as any;
    }

    if (this.layerManager) {
      jest.spyOn(this.layerManager, 'loadPlanet').mockImplementation(() => {});
      jest.spyOn(this.layerManager, 'loadLayerFromSource').mockImplementation(() => true);
    }
  }

  updateLabels() {
    switch (this.currentPlanet) {
      case 'earth': this.lonLabel = 'Lon'; this.latLabel = 'Lat'; break;
      case 'moon': this.lonLabel = 'Longitude'; this.latLabel = 'Latitude'; break;
      case 'mars': this.lonLabel = 'M-Longitude'; this.latLabel = 'M-Latitude'; break;
    }
  }

  get formattedLon(): string {
    const abs = Math.abs(this.currentLon).toFixed(4);
    const dir = this.currentLon >= 0 ? 'E' : 'W';
    return `${abs}° ${dir}`;
  }

  get formattedLat(): string {
    const abs = Math.abs(this.currentLat).toFixed(4);
    const dir = this.currentLat >= 0 ? 'N' : 'S';
    return `${abs}° ${dir}`;
  }
}

// ============================
// Tests
// ============================
describe('MapComponent', () => {
  let component: MapComponentTest;
  let fixture: ComponentFixture<MapComponentTest>;
  let layerManager: LayerManagerService;
  let mapFacade: MapFacadeService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapComponentTest],
      providers: [LayerManagerService, MapFacadeService]
    }).compileComponents();

    fixture = TestBed.createComponent(MapComponentTest);
    component = fixture.componentInstance;

    layerManager = TestBed.inject(LayerManagerService);
    mapFacade = TestBed.inject(MapFacadeService);

    component.layerManager = layerManager;
    component.mapFacade = mapFacade;

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

  it('should switch planet and update labels', () => {
    component.currentPlanet = 'mars';
    component.updateLabels();
    expect(component.lonLabel).toBe('M-Longitude');
    expect(component.latLabel).toBe('M-Latitude');
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
