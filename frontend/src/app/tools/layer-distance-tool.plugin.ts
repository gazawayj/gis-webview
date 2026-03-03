import Feature from 'ol/Feature';
import { LineString, Point } from 'ol/geom';
import { getLength } from 'ol/sphere';
import { PLANETS } from '../map/constants/map-constants';
import { LayerManagerService } from '../map/services/layer-manager.service';
import { ToolPluginBase } from './tool-base.plugin';
import { LayerConfig } from '../map/models/layer-config.model';
import { OverlayRef } from '@angular/cdk/overlay';

export class LayerDistanceToolPlugin extends ToolPluginBase {
    name = 'layer-distance';
    selectedLayers: [LayerConfig | null, LayerConfig | null] = [null, null];

    modalRef?: OverlayRef;
    onConfirmComplete?: () => void;

    protected override onActivate(): void { }

    computeDistance(layerA: LayerConfig, layerB: LayerConfig): number {
        const radius = PLANETS[this.layerManager.currentPlanet].radius;
        const getCentroid = (layer: LayerConfig): [number, number] => {
            const features = layer.features || [];
            if (!features.length) return [0, 0];
            return (features[0].getGeometry() as Point).getCoordinates() as [number, number];
        };
        return getLength(new LineString([getCentroid(layerA), getCentroid(layerB)]), { radius });
    }

    confirm() {
        const [layerA, layerB] = this.selectedLayers;
        if (!this.tempSource || !layerA || !layerB) return;

        // --- Line feature
        const cA = (layerA.features![0].getGeometry() as Point).getCoordinates() as [number, number];
        const cB = (layerB.features![0].getGeometry() as Point).getCoordinates() as [number, number];
        const lineFeature = this.createFeature(new LineString([cA, cB]), 'line');

        // --- Midpoint label
        const distanceMeters = this.computeDistance(layerA, layerB);
        const midpoint: [number, number] = [(cA[0] + cB[0]) / 2, (cA[1] + cB[1]) / 2];
        const labelFeature = this.createFeature(
            new Point(midpoint),
            'label',
            distanceMeters >= 1000
                ? `${(distanceMeters / 1000).toFixed(2)} km`
                : `${distanceMeters.toFixed(1)} m`,
            lineFeature,
            true,
            true
        );

        // Display immediately
        this.tempSource.addFeature(lineFeature);
        this.tempSource.addFeature(labelFeature);

        // --- Save via base pipeline
        const newLayer = this.save(`layer-distance_${Date.now()}`);

        // --- Notify MapComponent to update sidebar
        this.onConfirmComplete?.();

        // --- Reset plugin state
        this.selectedLayers = [null, null];
        this.cancel(); // removes tempSource & deactivates plugin
    }
}
