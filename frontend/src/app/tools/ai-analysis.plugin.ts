import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
import { ToolPluginBase } from './tool-base.plugin';
import { HttpClient } from '@angular/common/http';
import { LayerManagerService } from '../map/services/layer-manager.service';
import { StyleService } from '../map/services/style.service';

export interface AIResult {
  name: string;
  lat: number;
  lon: number;
  planet: string;
  selected?: boolean;
}

export class AIAnalysisPlugin extends ToolPluginBase {
  name = 'ai-analysis';
  private generatedFeatures: Feature[] = [];
  public aiResults: AIResult[] = [];
  private highlightFeature?: Feature;

  constructor(
    layerManager: LayerManagerService,
    private http: HttpClient,
    private styleService: StyleService
  ) {
    super(layerManager);
  }

  /** Plugin-specific activation: temp layer already exists */
  protected override onActivate(): void {
    if (!this.map || !this.tempSource || !this.activeLayer) return;

    // Initialize internal state
    this.generatedFeatures = [];
    this.aiResults = [];
    this.highlightFeature = undefined;
  }

  protected override onDeactivate(): void {
    this.generatedFeatures = [];
    this.aiResults = [];
    this.removeHighlightFeature();
  }

  private removeHighlightFeature() {
    if (this.highlightFeature && this.tempSource) {
      this.tempSource.removeFeature(this.highlightFeature);
      this.highlightFeature = undefined;
    }
  }

  /** Add points — style is handled by LayerManager style pipeline */
  addPoints(coords: [number, number][]) {
    if (!this.tempSource) return;

    coords.forEach(([lon, lat]) => {
      const projected = fromLonLat([lon, lat]);
      const f = this.createFeature(new Point(projected), 'point');
      this.tempSource?.addFeature(f);
      this.generatedFeatures.push(f);
    });
  }

  /** Run AI query, limited to current planet */
  async runAIQuery(prompt: string, addToMap = true): Promise<AIResult[]> {
    if (!prompt || !this.map) return [];

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

      if (addToMap && validCoords.length) {
        await this.flyToPoints(validCoords);
      }

      return this.aiResults;
    } catch (err) {
      console.error('AI: Error connecting to server', err);
      return [];
    }
  }

  /** Smoothly fly to points and add them to the temp layer */
  private async flyToPoints(coords: [number, number][]) {
    if (!this.map || !this.tempSource) return;

    const view = this.map.getView();

    for (const [lon, lat] of coords) {
      const projected = fromLonLat([lon, lat]);

      await new Promise<void>((resolve) => {
        const targetZoom = Math.max(view.getZoom() ?? 2, 6);
        view.animate(
          { center: projected, duration: 800 },
          { zoom: targetZoom, duration: 800 },
          () => resolve()
        );
      });

      // Small pause before adding permanent point
      await new Promise(r => setTimeout(r, 200));
      this.addPoints([[lon, lat]]);
    }
  }

  /** Add selected AI points to map */
  confirmSelectedPoints() {
    if (!this.aiResults || !this.tempSource) return;

    const selectedCoords: [number, number][] = this.aiResults
      .filter(r => r.selected && typeof r.lat === 'number' && typeof r.lon === 'number')
      .map(r => [r.lon, r.lat]);

    if (selectedCoords.length) this.addPoints(selectedCoords);
  }

  /** Save the temporary layer as permanent */
  override onSave(layer: { name: string }) {
    if (!layer.name) return;

    const savedLayer = this.save(layer.name);
    this.generatedFeatures = [];
    this.aiResults = [];
    this.removeHighlightFeature();
    console.log('AI Analysis layer saved', savedLayer);
  }
}