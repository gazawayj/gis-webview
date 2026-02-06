import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { MapService } from './map.service';
import { expect, describe, it, beforeEach, afterEach } from 'vitest';

describe('MapService Advanced Logic', () => {
  let service: MapService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [MapService]
    });
    service = TestBed.inject(MapService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should update visibleLayers computed signal when planet changes', () => {
    // Initial state is Earth
    expect(service.currentPlanet()).toBe('earth');
    const earthLayers = service.visibleLayers();
    expect(earthLayers.some(l => l.id === 'earth-base')).toBe(true);

    // Switch to Mars
    service.setPlanet('mars');
    const marsLayers = service.visibleLayers();
    expect(marsLayers.some(l => l.id === 'mars-base')).toBe(true);
    expect(marsLayers.some(l => l.id === 'earth-base')).toBe(false);
  });

  it('should fetch GeoJSON and add features when a vector layer is added', () => {
    const mockGeoJson = { type: 'FeatureCollection', features: [] };
    const vectorLayer = { id: 'test-vec', name: 'Test', type: 'vector', source: 'test.json', visible: true, zIndex: 1 };

    service.addLayer(vectorLayer as any, 'earth');

    const req = httpMock.expectOne('/assets/tiles/earth/test.json');
    expect(req.request.method).toBe('GET');
    req.flush(mockGeoJson); // Simulate successful file load
  });
});
