import { Injectable } from '@angular/core';
import Papa from 'papaparse';
import { LayerManagerService } from './layer-manager.service';
import { LayerConfig } from '../models/layer-config.model';

@Injectable({
  providedIn: 'root'
})
export class CsvImportService {

  constructor(private layerManager: LayerManagerService) {}

  /**
   * Reads a file as text.
   */
  readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);

      reader.readAsText(file);
    });
  }

  /**
   * Determines if a file is CSV or GeoJSON based on extension.
   */
  detectFileType(fileName: string): 'CSV' | 'GeoJSON' | null {
    const lower = fileName.toLowerCase();

    if (lower.endsWith('.csv')) return 'CSV';
    if (lower.endsWith('.geojson') || lower.endsWith('.json')) return 'GeoJSON';

    return null;
  }

  /**
   * Parses CSV headers for column detection.
   */
  extractCsvHeaders(csvContent: string): string[] {
    const parsed = Papa.parse(csvContent, {
      header: true,
      preview: 1
    });

    return parsed.meta.fields || [];
  }

  /**
   * Detects likely latitude and longitude columns.
   */
  detectLatLonColumns(headers: string[]): { lat?: string; lon?: string } {
    const lower = headers.map(h => h.toLowerCase());

    let lat: string | undefined;
    let lon: string | undefined;

    const latNames = ['lat', 'latitude', 'y'];
    const lonNames = ['lon', 'longitude', 'lng', 'x'];

    for (let i = 0; i < lower.length; i++) {
      if (!lat && latNames.includes(lower[i])) lat = headers[i];
      if (!lon && lonNames.includes(lower[i])) lon = headers[i];
    }

    return { lat, lon };
  }

  /**
   * Creates a layer from imported content.
   */
  createLayerFromImport(
    planet: 'earth' | 'moon' | 'mars',
    fileName: string,
    content: string,
    type: 'CSV' | 'GeoJSON',
    latField?: string,
    lonField?: string
  ): LayerConfig | undefined {

    const layerName = fileName.replace(/\.[^/.]+$/, '');

    if (type === 'CSV') {
      return this.layerManager.addManualLayer(
        planet,
        layerName,
        'Imported layer',
        content,
        'CSV',
        latField,
        lonField
      );
    }

    if (type === 'GeoJSON') {
      return this.layerManager.addManualLayer(
        planet,
        layerName,
        'Imported layer',
        content,
        'GeoJSON'
      );
    }

    return undefined;
  }
}