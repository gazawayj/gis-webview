/**
 * @file tool-plugin-base.spec.ts
 * @description Unit tests for the abstract ToolPluginBase using a concrete mock implementation.
 */

import '../../../test-setup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolPluginBase } from './tool-base.plugin';
import { LayerManagerService } from '../services/layer-manager.service';
import Map from 'ol/Map';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { Interaction } from 'ol/interaction';

/**
 * Concrete implementation of the abstract ToolPluginBase for testing purposes.
 */
class TestTool extends ToolPluginBase {
  name = 'test-tool';
  onActivateSpy = vi.fn();
  onDeactivateSpy = vi.fn();

  protected onActivate(): void {
    this.onActivateSpy();
  }

  protected override onDeactivate(): void {
    this.onDeactivateSpy();
  }

  // Expose protected methods for testing
  public testRegisterInteraction(i: Interaction) { this.registerInteraction(i); }
  public testRegisterMapListener(type: string, handler: any) { this.registerMapListener(type, handler); }
  public testCreateFeature(geom: any, type: any) { return this.createFeature(geom, type); }
}

describe('ToolPluginBase', () => {
  let tool: TestTool;
  let layerManagerMock: any;
  let mapMock: any;
  let mockSource: any;

  beforeEach(() => {
    // Mock OpenLayers Source
    mockSource = {
      addFeature: vi.fn(),
      getFeatures: vi.fn(() => []),
    };

    // Mock LayerManager
    layerManagerMock = {
      currentPlanet: 'mars',
      createLayer: vi.fn(() => ({
        olLayer: {
          getSource: () => mockSource,
          setStyle: vi.fn(),
        },
        color: '#ff0000',
        shape: 'circle'
      })),
      remove: vi.fn(),
      cloneFeature: vi.fn((f) => f),
      styleService: {
        allocateLayerStyle: vi.fn(() => ({ shape: 'circle', color: '#ff0000' })),
        getLayerStyle: vi.fn(() => []),
      }
    };

    // Mock OpenLayers Map
    mapMock = new Map();
    mapMock.addInteraction = vi.fn();
    mapMock.removeInteraction = vi.fn();
    mapMock.on = vi.fn();
    mapMock.un = vi.fn();

    tool = new TestTool(layerManagerMock as unknown as LayerManagerService);
  });

  /**
   * @test Activation Logic
   */
  it('should create a temporary layer and call onActivate when activated', () => {
    tool.activate(mapMock);

    expect(layerManagerMock.createLayer).toHaveBeenCalledWith(expect.objectContaining({
      isTemporary: true,
      planet: 'mars'
    }));
    expect(tool.onActivateSpy).toHaveBeenCalled();
    expect(tool.tempSource).toBeDefined();
  });

  /**
   * @test Interaction Registration
   */
  it('should register and clean up interactions', () => {
    const mockInteraction = new Interaction({});
    tool.activate(mapMock);
    
    tool.testRegisterInteraction(mockInteraction);
    expect(mapMock.addInteraction).toHaveBeenCalledWith(mockInteraction);

    tool.deactivate();
    expect(mapMock.removeInteraction).toHaveBeenCalledWith(mockInteraction);
    expect(layerManagerMock.remove).toHaveBeenCalled();
  });

  /**
   * @test Map Listener Cleanup
   */
  it('should register and unregister map event listeners', () => {
    const handler = vi.fn();
    tool.activate(mapMock);
    
    tool.testRegisterMapListener('click', handler);
    expect(mapMock.on).toHaveBeenCalledWith('click', handler);

    tool.deactivate();
    expect(mapMock.un).toHaveBeenCalledWith('click', handler);
  });

  /**
   * @test Feature Creation
   */
  it('should create a feature with correct metadata', () => {
    tool.activate(mapMock);
    const geom = new Point([0, 0]);
    const feature = tool.testCreateFeature(geom, 'point');

    expect(feature).toBeInstanceOf(Feature);
    expect(feature.get('featureType')).toBe('point');
    expect(feature.get('isToolFeature')).toBe(true);
  });

  /**
   * @test Saving Logic
   */
  it('should return null when saving if no features exist', () => {
    tool.activate(mapMock);
    const result = tool.save('Permanent Layer');
    expect(result).toBeNull();
  });

  it('should call createLayer with cloned features when saving', () => {
    tool.activate(mapMock);
    
    // Simulate a feature in the source
    const mockFeature = new Feature(new Point([0, 0]));
    mockFeature.set('isToolFeature', true);
    mockSource.getFeatures = vi.fn(() => [mockFeature]);

    tool.save('New Permanent Layer');

    expect(layerManagerMock.createLayer).toHaveBeenCalledWith(expect.objectContaining({
      name: 'New Permanent Layer',
      isTemporary: false
    }));
  });

  /**
   * @test Deactivation Lifecycle
   */
  it('should clean up all resources on deactivate', () => {
    tool.activate(mapMock);
    tool.deactivate();

    expect(tool.onDeactivateSpy).toHaveBeenCalled();
    expect(layerManagerMock.remove).toHaveBeenCalled();
    // Verify internal state reset
    expect((tool as any).map).toBeUndefined();
  });
});
