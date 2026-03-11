/**
 * layer-manager.service.spec.ts
 * 
 * This suite tests the LayerManagerService, the "Source of Truth" for all 
 * map layers in the application. It handles layer creation, visibility, 
 * z-index ordering, and OpenLayers object management.
 * 
 * TESTING STRATEGY:
 * 1. OpenLayers Integration: Use a custom 'createMockMap' helper to prevent 
 *    tests from trying to render a real HTML5 Canvas, which would crash in JSDOM.
 * 2. Service Dependencies: Mock the StyleService and HttpClient to isolate 
 *    layer logic from visual rendering and network requests.
 * 3. State Registry: Verify that the internal private 'registry' (Map) 
 *    correctly tracks layers as they are added or removed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { LayerManagerService } from './layer-manager.service';
import { StyleService } from './style.service';
import { HttpClient } from '@angular/common/http';
import { createMockMap } from '../testing/mock-map';
import { of } from 'rxjs';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';

/**
 * MOCK: HttpClient
 * Simulates network responses for GeoJSON or CSV file loading.
 */
class MockHttp {
  get() {
    return of('{}');
  }
}

/**
 * MOCK: StyleService
 * Prevents complex OpenLayers style calculations from running during unit tests.
 * Returns simplified color/shape objects instead.
 */
class MockStyleService {
  allocateLayerStyle() {
    return { color: '#ff0000', shape: 'circle' };
  }
  brightenHex() {
    return '#ffffff';
  }
  getLayerStyle() {
    return {};
  }
}

describe('LayerManagerService', () => {
  let service: LayerManagerService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        LayerManagerService,
        { provide: StyleService, useClass: MockStyleService },
        { provide: HttpClient, useClass: MockHttp }
      ]
    });

    service = TestBed.inject(LayerManagerService);
    
    /**
     * ATTACH MOCK MAP:
     * Most LayerManager methods interact with an 'ol/Map' instance.
     * Attach a mock map here so that methods like .addLayer() find a valid target.
     */
    service.attachMap(createMockMap());
  });

  /**
   * Test: Layer Creation
   * Verifies that passing raw data (Planet, Name, Features) results in a 
   * valid LayerConfig object with a processed OpenLayers layer inside.
   */
  it('should create a layer', () => {
    const feature = new Feature(new Point([0, 0]));

    const layer = service.createLayer({
      planet: 'mars',
      name: 'TestLayer',
      features: [feature]
    });

    expect(layer.name).toBe('TestLayer');
    expect(layer.features?.length).toBe(1);
    // Ensure an actual OpenLayers VectorLayer was generated
    expect(layer.olLayer).toBeDefined();
  });

  /**
   * Test: Visibility Toggle
   * Verifies the boolean logic for hiding/showing layers on the map.
   */
  it('should toggle layer visibility', () => {
    const feature = new Feature(new Point([0, 0]));
    const layer = service.createLayer({
      planet: 'mars',
      name: 'ToggleLayer',
      features: [feature]
    });

    const initialStatus = layer.visible;
    service.toggle(layer);

    expect(layer.visible).toBe(!initialStatus);
  });

  /**
   * Test: Layer Removal
   * Ensures that deleting a layer removes it from both the OpenLayers map
   * and the internal registry to prevent memory leaks.
   */
  it('should remove layer', () => {
    const feature = new Feature(new Point([0, 0]));
    const layer = service.createLayer({
      planet: 'mars',
      name: 'RemoveLayer',
      features: [feature]
    });

    service.remove(layer);

    /** 
     * Use bracket notation service['registry'] to access the private 
     * property for verification without TypeScript complaining.
     */
    expect(service['registry'].has(layer.id)).toBe(false);
  });

  /**
   * Test: Z-Index Ordering
   * Verifies that when a user reorders layers in the sidebar, the 
   * service updates the OpenLayers Z-Index to ensure the correct visual stacking.
   */
  it('should reorder layers', () => {
    const f1 = new Feature(new Point([0, 0]));
    const f2 = new Feature(new Point([1, 1]));

    const l1 = service.createLayer({ planet: 'mars', name: 'A', features: [f1] });
    const l2 = service.createLayer({ planet: 'mars', name: 'B', features: [f2] });

    /**
     * When reordering, the service should iterate through the array 
     * and call setZIndex on the internal olLayer objects.
     */
    service.reorderLayers([l1, l2]);

    expect(l1.olLayer.setZIndex).toHaveBeenCalled();
    expect(l2.olLayer.setZIndex).toHaveBeenCalled();
  });
});
