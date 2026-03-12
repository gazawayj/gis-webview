/**
 * @file distance-tool.plugin.spec.ts
 * @description Unit tests for DistanceToolPlugin.
 */

import '../../../test-setup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DistanceToolPlugin } from './distance-tool.plugin';
import Feature from 'ol/Feature';
import { LineString } from 'ol/geom';
import Map from 'ol/Map';
import View from 'ol/View';

describe('DistanceToolPlugin', () => {
  let plugin: DistanceToolPlugin;
  let mockLayerManager: any;
  let mockMap: Map;
  let mockSource: any;

  beforeEach(() => {
    mockSource = {
      addFeature: vi.fn(),
      removeFeature: vi.fn(),
      getFeatures: vi.fn(() => []),
      clear: vi.fn(),
    };

    mockLayerManager = {
      currentPlanet: 'earth',
      createLayer: vi.fn(() => ({
        olLayer: { getSource: () => mockSource, setStyle: vi.fn() },
        color: '#ff0000',
        shape: 'circle'
      })),
      remove: vi.fn(),
      styleService: {
        allocateLayerStyle: vi.fn(() => ({ shape: 'circle', color: '#ff0000' })),
        getLayerStyle: vi.fn(() => [])
      }
    };

    mockMap = new Map({
      target: document.createElement('div'),
      view: new View({ center: [0, 0], zoom: 2 })
    });

    plugin = new DistanceToolPlugin(mockLayerManager as any);
  });

  it('should initialize LineString draw interaction on activation', () => {
    plugin.activate(mockMap);
    const interactions = mockMap.getInteractions().getArray();
    const draw = interactions.find(i => i.constructor.name === 'Draw') as any;
    expect(draw).toBeDefined();
    expect(draw.type_).toBe('LineString');
  });

  it('should update a temporary live label during pointer move', () => {
    plugin.activate(mockMap);
    
    // Provide at least two coordinates so the plugin can access coords[coords.length - 2]
    // which is required by the logic to find the start of the current live segment.
    const mockLine = new Feature(new LineString([[0, 0], [10, 10]]));
    (plugin as any).currentFeature = mockLine;

    const moveHandler = (plugin as any).mapListeners.find((l: any) => l.type === 'pointermove').handler;
    
    // Simulate moving to a new coordinate far from the last point
    moveHandler({ coordinate: [1000, 1000] });

    // Look for the label feature added to the source
    const liveLabelCall = mockSource.addFeature.mock.calls.find(call => 
      call[0].get('featureType') === 'label'
    );

    expect(liveLabelCall).toBeDefined();
    // In DistanceToolPlugin, live labels are created with isLive=true (isToolFeature=false)
    expect(liveLabelCall[0].get('isToolFeature')).toBe(false);
  });

  it('should create vertices and segment labels when drawing completes', () => {
    plugin.activate(mockMap);
    const drawInteraction = (plugin as any).drawInteraction;
    
    const coords: [number, number][] = [[0, 0], [100, 100], [200, 200]];
    const mockLine = new Feature(new LineString(coords));
    
    (plugin as any).currentFeature = mockLine;
    drawInteraction!.dispatchEvent({ type: 'drawend', feature: mockLine });

    const addedFeatures = mockSource.addFeature.mock.calls.map(c => c[0]);
    const vertexFeatures = addedFeatures.filter(f => f.get('featureType') === 'vertex');
    const labelFeatures = addedFeatures.filter(f => f.get('featureType') === 'label');

    expect(vertexFeatures.length).toBe(3);
    expect(labelFeatures.length).toBe(2);
  });

  it('should finish the drawing on double-click', () => {
    plugin.activate(mockMap);
    const drawInteraction = (plugin as any).drawInteraction;
    const finishSpy = vi.spyOn(drawInteraction as any, 'finishDrawing');

    (plugin as any).currentFeature = new Feature(new LineString([[0, 0], [10, 10]]));

    const dblClickHandler = (plugin as any).mapListeners.find((l: any) => l.type === 'dblclick').handler;
    dblClickHandler({ preventDefault: vi.fn() });

    expect(finishSpy).toHaveBeenCalled();
  });

  it('should cleanup resources and remove interaction on deactivate', () => {
    plugin.activate(mockMap);
    const interaction = (plugin as any).drawInteraction;
    
    plugin.deactivate();

    const interactions = mockMap.getInteractions().getArray();
    expect(interactions).not.toContain(interaction);
    expect(mockLayerManager.remove).toHaveBeenCalled();
  });

  it('should handle Escape key to cancel drawing', () => {
    const cancelSpy = vi.spyOn(plugin, 'cancel');
    plugin.activate(mockMap);
    
    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    window.dispatchEvent(event);

    expect(cancelSpy).toHaveBeenCalled();
  });
});
