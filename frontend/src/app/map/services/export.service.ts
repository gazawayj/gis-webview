import { Injectable } from '@angular/core';
import GeoJSON from 'ol/format/GeoJSON';
import { saveAs } from 'file-saver';
import { LayerConfig } from '../models/layer-config.model';

@Injectable({
  providedIn: 'root'
})
export class ExportService {

  /**
   * Exports a layer to GeoJSON or CSV.
   */
  exportLayer(layer: LayerConfig, format: 'CSV' | 'GeoJSON'): void {

    const features = layer.features;

    if (!features || !features.length) return;

    if (format === 'GeoJSON') {

      const geojson = new GeoJSON().writeFeatures(features, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857'
      });

      saveAs(
        new Blob([geojson], { type: 'application/json' }),
        `${layer.name}.geojson`
      );

      return;
    }

    if (format === 'CSV') {

      const allKeys = Array.from(
        new Set(features.flatMap(f => Object.keys(f.getProperties())))
      );

      const rows: string[] = [];

      rows.push(allKeys.join(','));

      features.forEach(f => {

        const props = f.getProperties();

        const row = allKeys.map(k => {

          let val = props[k];

          if (val && typeof val === 'object')
            val = JSON.stringify(val);

          if (typeof val === 'string' &&
              (val.includes(',') || val.includes('"')))
            val = `"${val.replace(/"/g, '""')}"`;

          return val ?? '';

        }).join(',');

        rows.push(row);
      });

      saveAs(
        new Blob([rows.join('\n')], { type: 'text/csv' }),
        `${layer.name}.csv`
      );
    }
  }
}