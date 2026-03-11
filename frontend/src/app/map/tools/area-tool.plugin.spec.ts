/**
 * @file area-tool.plugin.spec.ts
 * @description Unit tests for the AreaToolPlugin.
 * Tests polygon drawing logic, area calculation, and resource cleanup.
 */

import '../../../test-setup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AreaToolPlugin } from './area-tool.plugin';
import Feature from 'ol/Feature';
import { Polygon, Point } from 'ol/geom';
import Map from 'ol/Map';
import View from 'ol/View';

describe('AreaToolPlugin', () => {
  let plugin: AreaToolPlugin;
  let mockLayerManager: any;
  let mockMap: Map;
  let mockSource: any;

  beforeEach(() => {
    // 1. Mock Source for the temporary tool layer
    mockSource = {
      addFeature: vi.fn(),
      removeFeature: vi.fn(),
      getFeatures: vi.fn(() => []),
      clear: vi.fn(),
    };

    // 2. Mock LayerManager with Planet constants
    mockLayerManager = {
      currentPlanet: 'mars',
      createLayer: vi.fn(() => ({
        olLayer: { getSource: () => mockSource, setStyle: vi.fn() },
        color: '#00ff00',
        shape: 'polygon'
      })),
      remove: vi.fn(),
      styleService: {
        allocateLayerStyle: vi.fn(() => ({ shape: 'polygon', color: '#00ff00' })),
        getLayerStyle: vi.fn(() => [])
      }
    };

    // 3. Setup Map
    mockMap = new Map({
      view: new View({ center: [0, 0], zoom: 1 })
    });

    plugin = new AreaToolPlugin(mockLayerManager as any);
  });

  /**
   * @test Tool Activation
   */
  it('should initialize draw interaction on activation', () => {
    plugin.activate(mockMap);
    
    // Check if draw interaction was added to the map
    const interactions = mockMap.getInteractions().getArray();
    const hasDraw = interactions.some(i => i.constructor.name === 'Draw');
    expect(hasDraw).toBe(true);
  });

  /**
   * @test Area Calculation & Feature Creation
   * Simulates the 'drawend' event with a mock polygon.
   */
  it('should calculate area and add vertices/labels on drawend', () => {
    plugin.activate(mockMap);
    
    // Find the draw interaction we just registered
    const drawInteraction = (plugin as any).drawInteraction;
    
    // Create a mock polygon feature (a 100x100 square)
    const mockPolygon = new Feature(new Polygon([[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]]));
    
    // Simulate 'drawstart'
    drawInteraction.dispatchEvent({ type: 'drawstart', feature: mockPolygon });
    expect(mockPolygon.get('featureType')).toBe('polygon');

    // Simulate 'drawend'
    drawInteraction.dispatchEvent({ type: 'drawend', feature: mockPolygon });

    // Verify vertices were added (4 corners + closing point = 5 features)
    // Verify label was added (1 feature)
    // total calls to addFeature should be 6
    expect(mockSource.addFeature).toHaveBeenCalledTimes(6);

    // Verify the label has text content (area string)
    const labelCall = mockSource.addFeature.mock.calls.find(call => 
        call[0].get('featureType') === 'label'
    );
    expect(labelCall[0].get('text')).toContain('m²');
  });

  /**
   * @test Live Label Updates
   * Simulates 'pointermove' while a feature is being drawn.
   */
  it('should update temporary labels during pointermove', () => {
    plugin.activate(mockMap);
    const drawInteraction = (plugin as any).drawInteraction;
    const mockPolygon = new Feature(new Polygon([[[0, 0], [10, 0], [10, 10]]]));
    
    // Start drawing
    drawInteraction.dispatchEvent({ type: 'drawstart', feature: mockPolygon });

    // Manually trigger the map listener registered by the plugin
    const moveHandler = (plugin as any).mapListeners.find((l: any) => l.type === 'pointermove').handler;
    moveHandler();

    // Verify a temporary label was added
    const tempLabel = mockSource.addFeature.mock.calls.find(call => 
        call[0].get('featureType') === 'label'
    );
    expect(tempLabel[0].get('isToolFeature')).toBe(false); // Live labels aren't saved
  });

  /**
   * @test Resource Cleanup
   */
  it('should abort drawing and clear source on deactivation', () => {
    plugin.activate(mockMap);
    const interaction = (plugin as any).drawInteraction;
    const abortSpy = vi.spyOn(interaction, 'abortDrawing');

    plugin.deactivate();

    expect(abortSpy).toHaveBeenCalled();
    expect(mockSource.clear).toHaveBeenCalled();
    expect((plugin as any).drawInteraction).toBeUndefined();
  });

  /**
   * @test Keyboard Interruption
   */
  it('should cancel the tool on Escape key press', () => {
    const cancelSpy = vi.spyOn(plugin, 'cancel');
    plugin.activate(mockMap);

    // Simulate DOM event
    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    window.dispatchEvent(event);

    expect(cancelSpy).toHaveBeenCalled();
  });
});
