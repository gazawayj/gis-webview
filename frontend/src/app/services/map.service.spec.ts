import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { MapService } from './map.service';
import { expect, describe, it, beforeEach, afterEach, vi } from 'vitest';

vi.mock('ol/Map', () => ({
  default: function() {
    return {
      on: vi.fn(),
      addLayer: vi.fn(),
      removeLayer: vi.fn(),
      setView: vi.fn(),
      getLayers: vi.fn().mockReturnValue({
        getArray: vi.fn().mockReturnValue([])
      }),
      getView: vi.fn().mockReturnValue({
        animate: vi.fn(),
        getProjection: vi.fn().mockReturnValue({ getCode: () => 'EPSG:3857' })
      })
    };
  }
}));

vi.mock('ol/control', () => ({
  ScaleLine: function() { return {}; }
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

    const mockEl = document.createElement('div');
    const mockScale = document.createElement('div');
    service.initMap(mockEl, mockScale as any);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should update visibleLayers computed signal when planet changes', () => {
    service.setPlanet('mars');
    const marsLayers = service.visibleLayers();
    expect(service.currentPlanet()).toBe('mars');
    expect(marsLayers.some(l => l.id === 'mars-base')).toBe(true);
  });

  it('should fetch GeoJSON and add features when a vector layer is added', () => {
    const vectorLayer = { 
      id: 'test-layer-' + Math.random(), 
      name: 'Test', 
      type: 'vector', 
      source: 'test.json', 
      visible: true 
    };

    service.addLayer(vectorLayer as any, 'earth');

    const req = httpMock.expectOne('/assets/tiles/earth/test.json');
    req.flush({ type: 'FeatureCollection', features: [] });
  });
});
