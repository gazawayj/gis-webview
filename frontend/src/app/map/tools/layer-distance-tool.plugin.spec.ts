/**
 * @file layer-distance-tool.plugin.spec.ts
 * @description Unit tests for LayerDistanceToolPlugin.
 */

import '../../../test-setup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LayerDistanceToolPlugin } from './layer-distance-tool.plugin';
import Feature from 'ol/Feature';
import { Point, LineString } from 'ol/geom';
import Map from 'ol/Map';
import View from 'ol/View';
import { LayerConfig } from '../models/layer-config.model';

describe('LayerDistanceToolPlugin', () => {
    let plugin: LayerDistanceToolPlugin;
    let mockLayerManager: any;
    let mockMap: Map;
    let mockSource: any;

    beforeEach(() => {
        mockSource = {
            addFeature: vi.fn(),
            addFeatures: vi.fn(),
            removeFeature: vi.fn(),
            getFeatures: vi.fn(() => []),
            clear: vi.fn(),
        };

        mockLayerManager = {
            currentPlanet: 'earth',
            createLayer: vi.fn(() => ({
                olLayer: { getSource: () => mockSource, setStyle: vi.fn() },
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

        plugin = new LayerDistanceToolPlugin(mockLayerManager as any);
    });

    const createMockLayer = (name: string, coords: [number, number][]): LayerConfig => {
        return {
            name,
            features: coords.map(c => new Feature(new Point(c))),
            planet: 'earth',
            id: Math.random().toString(),
            visible: true
        } as any;
    };

    it('should initialize with empty selections on activate', () => {
        plugin.activate(mockMap);
        expect(plugin.selectedLayers).toEqual([null, null]);
    });

    it('should extract points from different geometry types', () => {
        const layer = {
            features: [
                new Feature(new Point([10, 10])),
                new Feature(new LineString([[20, 20], [30, 30]]))
            ]
        } as any;

        const points = (plugin as any).getLayerPoints(layer);
        // Point (1) + LineString (2) = 3 coordinates
        expect(points.length).toBe(3);
    });

    it('should compute distance between two layers using KDTree', () => {
        plugin.activate(mockMap);
        const layerA = createMockLayer('A', [[0, 0]]);
        const layerB = createMockLayer('B', [[0, 1000]]); // ~1km north in simple units

        const distance = plugin.computeDistance(layerA, layerB);

        expect(distance).toBeGreaterThan(0);
        expect((plugin as any)._closestPair).toBeDefined();
    });

    it('should draw temporary distance features (line and label)', () => {
        plugin.activate(mockMap);
        const cA: [number, number] = [0, 0];
        const cB: [number, number] = [10, 10];
        const dist = 500;

        plugin.drawDistanceFeatures(cA, cB, dist);

        // Should add 1 line, 1 label, and 2 vertices (one for each end of the line)
        // Total addFeature/addFeatures calls depends on createDistanceFeature logic
        const addedFeatures = mockSource.addFeatures.mock.calls[0][0] as Feature[];
        const line = addedFeatures.find(f => f.get('featureType') === 'line');
        const label = addedFeatures.find(f => f.get('featureType') === 'label');

        expect(line).toBeDefined();
        expect(label).toBeDefined();
        expect(label?.get('text')).toBe('500.0 m');
    });

    it('should cleanup temporary distance features on deactivate', () => {
        plugin.activate(mockMap);
        const tempFeature = new Feature(new Point([0, 0]));
        tempFeature.set('isTempDistanceFeature', true);
        mockSource.getFeatures.mockReturnValue([tempFeature]);

        plugin.deactivate();

        expect(mockSource.removeFeature).toHaveBeenCalledWith(tempFeature);
        expect(plugin.selectedLayers).toEqual([null, null]);
    });

    it('should perform a full confirm workflow', async () => {
        plugin.activate(mockMap);

        // Create mock layers with actual features to ensure points are found
        const layerA = { name: 'A', features: [new Feature(new Point([0, 0]))] };
        const layerB = { name: 'B', features: [new Feature(new Point([0, 0]))] };
        plugin.selectedLayers = [layerA as any, layerB as any];

        // MANUALLY set internal state to bypass computation logic
        (plugin as any)._closestPair = [[10, 10], [11, 11]];
        // Mock computeDistance to return a non-zero value
        vi.spyOn(plugin, 'computeDistance').mockReturnValue(100);

        const mockModal = { dispose: vi.fn() };
        plugin.modalRef = mockModal as any;

        // Use vi.spyOn on the instance specifically
        const saveSpy = vi.spyOn(plugin as any, 'saveAsync').mockResolvedValue({} as any);
        const flySpy = vi.spyOn(plugin as any, 'flyToCoordinates').mockResolvedValue(undefined);

        await plugin.confirm();

        expect(saveSpy).toHaveBeenCalled();
        expect(mockModal.dispose).toHaveBeenCalled();
        expect(flySpy).toHaveBeenCalled();
    });


    it('should correctly format distance labels', () => {
        plugin.activate(mockMap);

        // Test meters
        plugin.drawDistanceFeatures([0, 0], [1, 1], 950.44);
        let label = mockSource.addFeatures.mock.calls[0][0].find((f: any) => f.get('featureType') === 'label');
        expect(label.get('text')).toBe('950.4 m');

        // Test kilometers
        plugin.drawDistanceFeatures([0, 0], [1, 1], 1250.66);
        label = mockSource.addFeatures.mock.calls[1][0].find((f: any) => f.get('featureType') === 'label');
        expect(label.get('text')).toBe('1.25 km');
    });
});
