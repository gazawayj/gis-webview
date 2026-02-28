import { describe, it, expect, beforeEach } from 'vitest';

// Mock MapComponent
class MockMapComponent {
  currentPlanet: 'earth' | 'moon' | 'mars' = 'earth';
  zoomDisplay = '2';
  currentLon = 0;
  currentLat = 0;
  lonLabel = 'Lon';
  latLabel = 'Lat';

  updateLabels() {
    switch (this.currentPlanet) {
      case 'earth':
        this.lonLabel = 'Lon';
        this.latLabel = 'Lat';
        break;
      case 'moon':
        this.lonLabel = 'Longitude';
        this.latLabel = 'Latitude';
        break;
      case 'mars':
        this.lonLabel = 'M-Longitude';
        this.latLabel = 'M-Latitude';
        break;
      default:
        this.lonLabel = 'Lon';
        this.latLabel = 'Lat';
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

// Tests
describe('MapComponent (minimal)', () => {
  let component: MockMapComponent;

  beforeEach(() => {
    component = new MockMapComponent();
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
