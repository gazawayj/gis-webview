/**
 * Unit tests for LayerManagerService, the "Source of Truth" for all map layers.
 * Handles creation, visibility, z-index ordering, and OpenLayers object management.
 *
 * Testing strategy:
 * 1. Mock OpenLayers map to avoid rendering in JSDOM.
 * 2. Replace StyleService and HttpClient with mocks to isolate logic.
 * 3. Verify private layer registry via bracket notation.
 */
import '../../../test-setup'; 
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LayerManagerService } from './layer-manager.service';
import { StyleService } from './style.service';
import { HttpClient } from '@angular/common/http';
import { createMockMap } from '../testing/mock-map';
import { Feature } from 'ol';
import Point from 'ol/geom/Point';
import { of } from 'rxjs';
import { createService, MockHttpClient } from '../testing/test-harness';

/**
 * MOCK: StyleService
 * Simplifies color/shape allocation and prevents complex OL style logic.
 */
class MockStyleService {
  allocateLayerStyle() {
    return { color: '#ff0000', shape: 'circle' };
  }
  brightenHex(hex: string) {
    return '#ffffff';
  }
  getLayerStyle() {
    return {};
  }
}

describe('LayerManagerService', () => {
  let service: LayerManagerService;

  /**
   * beforeEach:
   * Uses the test harness createService() function to inject the service
   * with mocked dependencies. Attaches a fake OpenLayers map for safe testing.
   */
  beforeEach(() => {
    service = createService(LayerManagerService, [
      { provide: StyleService, useClass: MockStyleService },
      { provide: HttpClient, useClass: MockHttpClient }
    ]);

    // Provide a fake OpenLayers map instance so layer methods can run
    service.attachMap(createMockMap());
  });

  /**
   * TEST: Layer Creation
   * Verifies that createLayer() returns a valid LayerConfig with a processed OL layer.
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
    expect(layer.olLayer).toBeDefined(); // OL VectorLayer generated
  });

  /**
   * TEST: Visibility Toggle
   * Checks that toggling a layer updates its boolean visibility.
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
   * TEST: Layer Removal
   * Ensures a layer is removed from the registry and OL map.
   */
  it('should remove layer', () => {
    const feature = new Feature(new Point([0, 0]));
    const layer = service.createLayer({
      planet: 'mars',
      name: 'RemoveLayer',
      features: [feature]
    });

    service.remove(layer);

    // Access private 'registry' safely with bracket notation
    expect(service['registry'].has(layer.id)).toBe(false);
  });

  /**
   * TEST: Z-Index Ordering
   * Verifies that reorderLayers updates OL layer z-index for proper stacking.
   */
  it('should reorder layers', () => {
    const f1 = new Feature(new Point([0, 0]));
    const f2 = new Feature(new Point([1, 1]));

    const l1 = service.createLayer({ planet: 'mars', name: 'A', features: [f1] });
    const l2 = service.createLayer({ planet: 'mars', name: 'B', features: [f2] });

    // Reorder triggers setZIndex on each OL layer
    service.reorderLayers([l1, l2]);

    expect(l1.olLayer.setZIndex).toHaveBeenCalled();
    expect(l2.olLayer.setZIndex).toHaveBeenCalled();
  });
});