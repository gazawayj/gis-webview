import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MapComponent } from './map.component';

describe('MapComponent', () => {
  let component: MapComponent;
  let fixture: ComponentFixture<MapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(MapComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('basemap layer is visible by default', () => {
  const basemap = component.layers.find(l => l.type === 'basemap');
  expect(basemap?.visible).true;
});

  it('defaults to earth', () => {
    expect(component.currentPlanet).toBe('earth');
  });
});