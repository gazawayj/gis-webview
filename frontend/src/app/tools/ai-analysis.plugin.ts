import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
import { ToolPluginBase } from './tool-base.plugin';
import { HttpClient } from '@angular/common/http';
import { LayerManagerService } from '../map/services/layer-manager.service';
import { StyleService } from '../map/services/style.service';
import { extend as extendExtent, boundingExtent } from 'ol/extent';

export interface AIResult {
  name: string;
  lat: number;
  lon: number;
  planet: string;
  selected?: boolean;
}

export class AIAnalysisPlugin extends ToolPluginBase {
  name = 'ai-analysis';
  public isRunning = false;
  private generatedFeatures: Feature[] = [];
  public aiResults: AIResult[] = [];
  private highlightFeature?: Feature;
  private lastQuery = '';

  constructor(
    layerManager: LayerManagerService,
    private http: HttpClient,
    private styleService: StyleService
  ) {
    super(layerManager);
  }

  protected override onActivate(): void {
    if (!this.map || !this.tempSource || !this.activeLayer) return;

    this.generatedFeatures = [];
    this.aiResults = [];
    this.highlightFeature = undefined;
    this.lastQuery = '';
  }

  protected override onDeactivate(): void {
    this.generatedFeatures = [];
    this.aiResults = [];
    this.removeHighlightFeature();
    this.lastQuery = '';
  }

  private removeHighlightFeature() {
    if (this.highlightFeature && this.tempSource) {
      this.tempSource.removeFeature(this.highlightFeature);
      this.highlightFeature = undefined;
    }
  }

  private sanitizeName(name: string): string {
    return name
      .trim()
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .replace(/\s+/g, '');
  }

  addPoints(coords: [number, number][]) {
    if (!this.tempSource) return;

    coords.forEach(([lon, lat]) => {
      const projected = fromLonLat([lon, lat]);
      const f = this.createFeature(new Point(projected), 'point');
      this.tempSource?.addFeature(f);
      this.generatedFeatures.push(f);
    });
  }

  async runAIQuery(prompt: string, addToMap = true): Promise<AIResult[]> {
    if (!prompt || !this.map) return [];

    this.lastQuery = prompt;
    this.isRunning = true; // start spinner for the network call

    const currentPlanet = this.layerManager.currentPlanet;
    const promptWithPlanet = `${prompt} on ${currentPlanet}`;

    try {
      const res = await this.http
        .get<any>(`https://gazawayj.pythonanywhere.com/search?q=${encodeURIComponent(promptWithPlanet)}`)
        .toPromise();

      const resultsArray: AIResult[] = Array.isArray(res) ? res : [res];
      const validCoords: [number, number][] = [];

      this.aiResults = resultsArray
        .filter(r => typeof r.lat === 'number' && typeof r.lon === 'number')
        .map(r => {
          validCoords.push([r.lon, r.lat]);
          return { ...r, selected: true };
        });

      // stop spinner **before** flying
      this.isRunning = false;

      if (addToMap && validCoords.length) {
        await this.flyToPoints(validCoords); // animation happens without spinner
      }

      return this.aiResults;
    } catch (err) {
      console.error('AI: Error connecting to server', err);
      this.isRunning = false; // ensure spinner stops on error
      return [];
    }
  }

  async flyToPoints(coords: [number, number][]) {
    if (!this.map || !this.tempSource) return;

    const view = this.map.getView();
    const projectedCoords: [number, number][] = [];

    for (const [lon, lat] of coords) {
      const projected = fromLonLat([lon, lat]) as [number, number];
      projectedCoords.push(projected);

      await new Promise<void>((resolve) => {
        const targetZoom = Math.max(view.getZoom() ?? 2, 6);
        view.animate(
          { center: projected, duration: 800 },
          { zoom: targetZoom, duration: 800 },
          () => resolve()
        );
      });

      await new Promise(r => setTimeout(r, 200));
      this.addPoints([[lon, lat]]);
    }

    if (projectedCoords.length > 1) {
      let extent = boundingExtent([projectedCoords[0], projectedCoords[0]]);
      projectedCoords.forEach(coord => extendExtent(extent, coord));

      view.fit(extent, {
        padding: [50, 50, 50, 50],
        duration: 800,
        maxZoom: 12
      });
    }
  }

  confirmSelectedPoints() {
    if (!this.aiResults || !this.tempSource) return;

    const selectedCoords: [number, number][] = this.aiResults
      .filter(r => r.selected && typeof r.lat === 'number' && typeof r.lon === 'number')
      .map(r => [r.lon, r.lat]);

    if (selectedCoords.length) this.addPoints(selectedCoords);
  }

  override onSave(layer: { name: string }) {
    // Determine the preferred name from AI results or last query
    let preferredName: string;

    if (this.aiResults.length && this.aiResults[0].name) {
      preferredName = this.aiResults[0].name;
    } else if (this.lastQuery) {
      preferredName = this.lastQuery;
    } else {
      preferredName = `AI_${Date.now()}`; // fallback, just in case
    }

    // Sanitize: remove special chars and spaces
    const sanitizedName = preferredName.trim().replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_');

    // Call base save() with sanitized name
    const savedLayer = this.save(sanitizedName);

    // Clear temporary state
    this.generatedFeatures = [];
    this.aiResults = [];
    this.removeHighlightFeature();
    this.lastQuery = '';

    console.log('AI Analysis layer saved', savedLayer);
  }
}