import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { MapService } from './map.service';
import { expect, describe, it, beforeEach, afterEach, vi } from 'vitest';

vi.mock('ol/Map', () => ({
  default: function () {
    return {
      on: vi.fn(),
      addLayer: vi.fn(),
      setView: vi.fn(),
      getView: vi.fn().mockReturnValue({
        animate: vi.fn(),
        getProjection: vi.fn().mockReturnValue({ getCode: () => 'EPSG:3857' })
      })
    };
  }
}));

// Also ensure ScaleLine is mocked as a constructor
vi.mock('ol/control', () => ({
  ScaleLine: function () { return {}; }
}));

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

    // CRITICAL: Initialize the map so guards like 'if (!map) return' are bypassed
    const mockEl = document.createElement('div');
    const mockScale = document.createElement('div');
    service.initMap(mockEl, mockScale as any);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should update visibleLayers computed signal when planet changes', () => {
    // Force switch to mars
    service.setPlanet('mars');
    
    // Read signal to trigger computed update
    const marsLayers = service.visibleLayers();
    
    expect(service.currentPlanet()).toBe('mars');
    expect(marsLayers.some(l => l.id === 'mars-base')).toBe(true);
  });

  it('should fetch GeoJSON and add features when a vector layer is added', () => {
    const uniqueId = 'test-layer-' + Math.random();
    const vectorLayer = { 
      id: uniqueId, 
      name: 'Test', 
      type: 'vector', 
      source: 'test.json', 
      visible: true 
    };

    // This will now trigger the http.get call because map() is defined
    service.addLayer(vectorLayer as any, 'earth');

    const req = httpMock.expectOne('/assets/tiles/earth/test.json');
    expect(req.request.method).toBe('GET');
    req.flush({ type: 'FeatureCollection', features: [] });
  });
});
