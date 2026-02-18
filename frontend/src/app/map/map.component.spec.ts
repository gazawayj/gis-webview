// frontend/src/app/map/map.component.spec.ts
import { Component, ElementRef, ViewChild, AfterViewInit, TemplateRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { vi } from 'vitest';

import { MapComponent } from './map.component';
import { LayerManagerService } from './services/layer-manager.service';
import { MapFacadeService } from './services/map-facade.service';

// ============================
// Mock Services
// ============================
class MockLayerManagerService {
  layers: any[] = [];
  loadingLayers$ = { value: [], subscribe: () => {} };
  attachMap = vi.fn();
  loadPlanet = vi.fn();
  loadLayerFromSource = vi.fn();
  addManualLayer = vi.fn();
  reorderLayers = vi.fn();
  toggle = vi.fn();
  remove = vi.fn();
  updateStyle = vi.fn();
}

class MockMapFacadeService {
  map: any = { 
    addLayer: vi.fn(), 
    removeLayer: vi.fn(), 
    getView: () => ({ setCenter: vi.fn(), setZoom: vi.fn() }), 
    on: vi.fn() 
  };
  initMap = vi.fn();
  setPlanet = vi.fn();
  trackPointer = vi.fn((fn: any) => {});
}

// ============================
// Inline Test Wrapper Component
// ============================
@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  template: `<div #mapContainer></div><ng-template #addLayerModal></ng-template>`,
  styles: []
})
class MapComponentTest extends MapComponent implements AfterViewInit {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('addLayerModal') addLayerModal!: TemplateRef<any>;

  ngAfterViewInit() {
    // Assign mock services
    if (this.mapFacade) {
      this.mapFacade.map = {
        addLayer: vi.fn(),
        removeLayer: vi.fn(),
        getView: () => ({ setCenter: vi.fn(), setZoom: vi.fn() }),
        on: vi.fn()
      };
    }

    if (this.layerManager) {
      vi.spyOn(this.layerManager, 'loadPlanet').mockImplementation(() => {});
      vi.spyOn(this.layerManager, 'loadLayerFromSource').mockImplementation(() => true);
    }
  }
}

// ============================
// Tests
// ============================
describe('MapComponent (minimal)', () => {
  let component: MapComponentTest;
  let fixture: ComponentFixture<MapComponentTest>;
  let layerManager: LayerManagerService;
  let mapFacade: MapFacadeService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapComponentTest],
      providers: [
        { provide: LayerManagerService, useClass: MockLayerManagerService },
        { provide: MapFacadeService, useClass: MockMapFacadeService }
      ]
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

    component.currentPlanet = 'moon';
    component.updateLabels();
    expect(component.lonLabel).toBe('Longitude');
    expect(component.latLabel).toBe('Latitude');

    component.currentPlanet = 'earth';
    component.updateLabels();
    expect(component.lonLabel).toBe('Lon');
    expect(component.latLabel).toBe('Lat');
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
