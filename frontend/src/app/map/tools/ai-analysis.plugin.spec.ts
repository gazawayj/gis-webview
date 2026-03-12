/**
 * @file ai-analysis.plugin.spec.ts
 * @description Unit tests for AIAnalysisPlugin.
 */

import '../../../test-setup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIAnalysisPlugin, AIResult } from './ai-analysis.plugin';
import { of, throwError } from 'rxjs';
import Feature from 'ol/Feature';
import { Point } from 'ol/geom';
import Map from 'ol/Map';
import View from 'ol/View';

describe('AIAnalysisPlugin', () => {
    let plugin: AIAnalysisPlugin;
    let mockLayerManager: any;
    let mockHttp: any;
    let mockStyleService: any;
    let mockMap: Map;
    let mockSource: any;

    beforeEach(() => {
        mockSource = {
            addFeature: vi.fn(),
            getFeatures: vi.fn(() => []),
            clear: vi.fn(),
        };

        mockLayerManager = {
            currentPlanet: 'mars',
            startExternalLoad: vi.fn(),
            endExternalLoad: vi.fn(),
            createLayer: vi.fn(() => ({
                olLayer: { getSource: () => mockSource, setStyle: vi.fn() },
            })),
            styleService: {
                allocateLayerStyle: vi.fn(() => ({ shape: 'circle', color: '#ff0000' })),
                getLayerStyle: vi.fn(() => [])
            }
        };

        mockHttp = {
            get: vi.fn()
        };

        mockStyleService = {
            getLayerStyle: vi.fn()
        };

        mockMap = new Map({
            target: document.createElement('div'),
            view: new View({ center: [0, 0], zoom: 2 })
        });

        plugin = new AIAnalysisPlugin(mockLayerManager as any, mockHttp as any, mockStyleService as any);
    });

    it('should initialize with name "ai-analysis"', () => {
        expect(plugin.name).toBe('ai-analysis');
    });

    describe('runAIQuery', () => {
        it('should call the correct AI endpoint with planet context', async () => {
            const mockResponse: AIResult[] = [{ name: 'Olympus Mons', lat: 18.65, lon: 226.2, planet: 'mars', details: 'Large volcano' }];
            mockHttp.get.mockReturnValue(of(mockResponse));

            plugin.activate(mockMap);
            const results = await plugin.runAIQuery('volcanoes');

            expect(mockHttp.get).toHaveBeenCalledWith(expect.stringContaining('volcanoes%20on%20mars'));
            expect(results.length).toBe(1);
            expect(mockLayerManager.startExternalLoad).toHaveBeenCalled();
            expect(mockLayerManager.endExternalLoad).toHaveBeenCalled();
        });

        it('should handle API errors gracefully', async () => {
            // Define alert on the global/window object so Vitest can spy on it
            if (!(global as any).alert) {
                (global as any).alert = vi.fn();
            }
            const alertSpy = vi.spyOn(global as any, 'alert').mockImplementation(() => { });
            mockHttp.get.mockReturnValue(throwError(() => new Error('API Down')));
            plugin.activate(mockMap);
            const results = await plugin.runAIQuery('test');
            expect(results).toEqual([]);
            // Verify that the user was notified of the failure
            expect(alertSpy).toHaveBeenCalled();
            expect(mockLayerManager.endExternalLoad).toHaveBeenCalled();
            alertSpy.mockRestore();
        });

        describe('execute workflow', () => {
            it('should plot points and fly to results', async () => {
                const mockResults: AIResult[] = [
                    { name: 'Site A', lat: 10, lon: 10, planet: 'mars', details: 'Rocks' },
                    { name: 'Site B', lat: 20, lon: 20, planet: 'mars', details: 'Dust' }
                ];

                // Mock sequence: Query -> addPoints -> flyTo -> save
                vi.spyOn(plugin, 'runAIQuery').mockResolvedValue(mockResults);
                const addPointsSpy = vi.spyOn(plugin, 'addPoints');
                const saveSpy = vi.spyOn(plugin as any, 'saveAsync').mockResolvedValue({} as any);

                // Mock view fitting
                const fitSpy = vi.spyOn(mockMap.getView(), 'fit');

                plugin.activate(mockMap);
                await plugin.execute('find sites');

                expect(addPointsSpy).toHaveBeenCalledWith(
                    [[10, 10], [20, 20]],
                    ['Site A', 'Site B'],
                    ['Rocks', 'Dust']
                );
                expect(saveSpy).toHaveBeenCalled();
            });
        });

        describe('addPoints', () => {
            it('should add point and label features to the source', () => {
                plugin.activate(mockMap);
                (plugin as any).tempSource = mockSource;

                plugin.addPoints([[10, 10]], ['Feature Name'], ['Feature Details']);

                // 1 Point Feature + 1 Label Feature = 2 calls
                expect(mockSource.addFeature).toHaveBeenCalledTimes(2);

                const features = mockSource.addFeature.mock.calls.map(call => call[0]);
                const point = features.find(f => f.get('featureType') === 'point');
                const label = features.find(f => f.get('featureType') === 'label');

                expect(point.get('details')).toBe('Feature Details');
                expect(label.get('text')).toBe('Feature Name');
            });

            it('should apply a transparent style to point features', () => {
                plugin.activate(mockMap);
                (plugin as any).tempSource = mockSource;

                plugin.addPoints([[0, 0]], ['Test'], []);

                const features = mockSource.addFeature.mock.calls.map(call => call[0]);
                const point = features.find(f => f.get('featureType') === 'point');

                const style = point.getStyle();
                expect(style).toBeDefined();
                // Check fill color is transparent
                expect(style.getFill().getColor()).toBe('rgba(0, 0, 0, 0)');
            });
        });
    });
});
