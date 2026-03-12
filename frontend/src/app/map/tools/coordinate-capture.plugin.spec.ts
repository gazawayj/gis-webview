/**
 * @file coordinate-capture.plugin.spec.ts
 * @description Unit tests for CoordinateCapturePlugin.
 * Tests hover vertex movement, coordinate formatting, and click-to-capture logic.
 */

import '../../../test-setup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CoordinateCapturePlugin } from './coordinate-capture.plugin';
import Feature from 'ol/Feature';
import { Point } from 'ol/geom';
import Map from 'ol/Map';
import View from 'ol/View';

describe('CoordinateCapturePlugin', () => {
    let plugin: CoordinateCapturePlugin;
    let mockLayerManager: any;
    let mockMap: Map;
    let mockSource: any;

    beforeEach(() => {
        // Mock Source for temporary features
        mockSource = {
            addFeature: vi.fn(),
            addFeatures: vi.fn(),
            removeFeature: vi.fn(),
            getFeatures: vi.fn(() => []),
            clear: vi.fn(),
        };

        // Mock LayerManager
        mockLayerManager = {
            currentPlanet: 'earth',
            createLayer: vi.fn(() => ({
                olLayer: { getSource: () => mockSource, setStyle: vi.fn() },
                color: '#0000ff',
                shape: 'square'
            })),
            remove: vi.fn(),
            styleService: {
                allocateLayerStyle: vi.fn(() => ({ shape: 'square', color: '#0000ff' })),
                getLayerStyle: vi.fn(() => [])
            }
        };

        // Setup Map (Targeting #map from domino)
        mockMap = new Map({
            target: document.createElement('div'),
            view: new View({ center: [0, 0], zoom: 2 })
        });

        plugin = new CoordinateCapturePlugin(mockLayerManager as any);
    });

    it('should initialize with the correct name', () => {
        expect(plugin.name).toBe('coordinate-capture');
    });

    it('should create a hover feature on activation', () => {
        plugin.activate(mockMap);

        // Check if the hover feature (pointerVertex) was added
        const hoverFeature = mockSource.addFeature.mock.calls[0][0];
        expect(hoverFeature.get('featureType')).toBe('pointerVertex');
        expect(hoverFeature.get('isToolFeature')).toBe(false); // Hover is not saved
    });

    it('should move the hover feature on pointermove', () => {
        plugin.activate(mockMap);
        const hoverFeature = (plugin as any).hoverFeature;
        const geom = hoverFeature.getGeometry() as Point;
        const setCoordsSpy = vi.spyOn(geom, 'setCoordinates');

        // Trigger pointermove handler
        const moveHandler = (plugin as any).mapListeners.find((l: any) => l.type === 'pointermove').handler;
        const testCoord: [number, number] = [123, 456];
        moveHandler({ coordinate: testCoord });

        expect(setCoordsSpy).toHaveBeenCalledWith(testCoord);
    });

    it('should capture point and format coordinates on singleclick', () => {
        plugin.activate(mockMap);

        // Trigger singleclick handler
        const clickHandler = (plugin as any).mapListeners.find((l: any) => l.type === 'singleclick').handler;
        const testCoord: [number, number] = [1000, 2000];
        clickHandler({ coordinate: testCoord });

        // Expect addFeatures to be called with [Point, Label]
        expect(mockSource.addFeatures).toHaveBeenCalled();
        const capturedFeatures = mockSource.addFeatures.mock.calls[0][0] as Feature[];

        const point = capturedFeatures.find(f => f.get('featureType') === 'point');
        const label = capturedFeatures.find(f => f.get('featureType') === 'label');

        expect(point).toBeDefined();
        expect(label).toBeDefined();

        // Check coordinate formatting (fixed to 4 decimal places by plugin)
        expect(label?.get('text')).toMatch(/\d+\.\d{4}, \d+\.\d{4}/);
    });

    it('should replace existing capture if clicked a second time', () => {
        plugin.activate(mockMap);
        const clickHandler = (plugin as any).mapListeners.find((l: any) => l.type === 'singleclick').handler;
        // First click
        clickHandler({ coordinate: [1, 1] });
        // Second click
        clickHandler({ coordinate: [2, 2] });
        // removeFeature should be called for the first point and label
        expect(mockSource.removeFeature).toHaveBeenCalledTimes(2);
    });

    it('should remove the hover feature before saving', () => {
        // Activate to create the hoverFeature
        plugin.activate(mockMap);
        const hoverFeature = (plugin as any).hoverFeature;

        // Mock createLayer so the base class 'save' can complete without real map logic
        vi.spyOn(mockLayerManager, 'createLayer').mockReturnValue({
            olLayer: { getSource: () => mockSource, setStyle: vi.fn() }
        } as any);

        // Call the plugin's save - this should now execute: 
        // this.tempSource.removeFeature(this.hoverFeature)
        plugin.save('Captured Coordinate');

        // Verify the side effect
        expect(mockSource.removeFeature).toHaveBeenCalledWith(hoverFeature);
        expect((plugin as any).hoverFeature).toBeUndefined();
    });



    it('should cleanup resources and remove hover on deactivate', () => {
        plugin.activate(mockMap);
        const hoverFeature = (plugin as any).hoverFeature;

        plugin.deactivate();

        expect(mockSource.removeFeature).toHaveBeenCalledWith(hoverFeature);
        expect((plugin as any).hoverFeature).toBeUndefined();
        expect(mockLayerManager.remove).toHaveBeenCalled();
    });

    it('should cancel the tool on Escape key', () => {
        const cancelSpy = vi.spyOn(plugin, 'cancel');
        plugin.activate(mockMap);

        const event = new KeyboardEvent('keydown', { key: 'Escape' });
        window.dispatchEvent(event);

        expect(cancelSpy).toHaveBeenCalled();
    });
});
