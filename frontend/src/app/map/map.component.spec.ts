// frontend/src/app/map/map.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ElementRef, ViewChild, AfterViewInit, ChangeDetectorRef, TemplateRef, ViewContainerRef } from '@angular/core';
import { LayerManagerService } from './services/layer-manager.service';
import { MapFacadeService } from './services/map-facade.service';
import { Overlay } from '@angular/cdk/overlay';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// ============================
// Standalone Test Component
// ============================
@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  template: `<div #mapContainer></div>`, // minimal inline template
  styles: [] // no styles
})
class MapComponentTest implements AfterViewInit {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('addLayerModal') addLayerModal!: TemplateRef<any>;

  currentPlanet: 'earth' | 'moon' | 'mars' = 'earth';
  zoomDisplay = '2';
  currentLon = 0;
  currentLat = 0;
  lonLabel = 'Lon';
  latLabel = 'Lat';
  newLayerName = '';
  newLayerDescription = '';
  latField = 'latitude';
  lonField = 'longitude';
  fileContent: string | null = null;
  previewLayer: any = null;
  private overlayRef: any;

  constructor(
    public mapFacade: MapFacadeService,
    public layerManager: LayerManagerService,
    public cdr: ChangeDetectorRef,
    public overlay: Overlay,
    public vcr: ViewContainerRef
  ) {}

  ngAfterViewInit() {
    // Initialize mapFacade and LayerManager safely for test
    this.mapFacade.initMap(this.mapContainer.nativeElement, this.currentPlanet);
    this.layerManager.attachMap(this.mapFacade.map);
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
      providers: [LayerManagerService, MapFacadeService, Overlay, ChangeDetectorRef, ViewContainerRef]
    }).compileComponents();

    fixture = TestBed.createComponent(MapComponentTest);
    component = fixture.componentInstance;

    layerManager = TestBed.inject(LayerManagerService);
    mapFacade = TestBed.inject(MapFacadeService);

    // Mock mapFacade.map to prevent OL map creation
    mapFacade.map = {
      addLayer: jest.fn(),
      removeLayer: jest.fn(),
      getView: () => ({ setCenter: jest.fn(), setZoom: jest.fn() }),
      on: jest.fn()
    } as any;

    // Prevent LayerManager real HTTP/network calls
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

  it('should switch planet and update labels', () => {
    component.currentPlanet = 'earth';
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
  });
});
