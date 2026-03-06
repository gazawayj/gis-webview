import Feature from 'ol/Feature';
import { ToolPluginBase } from './tool-base.plugin';
import { HttpClient } from '@angular/common/http';
import { LayerManagerService } from '../services/layer-manager.service';
import { StyleService } from '../services/style.service';
import { boundingExtent, extend as extendExtent } from 'ol/extent';

export interface AIResult {
  name: string;
  lat: number;
  lon: number;
  planet: string;
}

export class AIAnalysisPlugin extends ToolPluginBase {
  name = 'ai-analysis';
  private aiResults: AIResult[] = [];

  constructor(
    layerManager: LayerManagerService,
    private http: HttpClient,
    private styleService: StyleService
  ) {
    super(layerManager);
  }

  async execute(prompt: string): Promise<void> {
  if (!prompt) return;

  const results = await this.runAIQuery(prompt);
  if (!results.length) return;

  const coords: [number, number][] = results
    .filter(r => typeof r.lat === 'number' && typeof r.lon === 'number')
    .map(r => [r.lon, r.lat]);

  if (!coords.length) return;

  // Draw features
  this.addPoints(coords);

  // Fly to each point individually
  for (const c of coords) {
    await this.flyToCoordinates([c], { minZoom: 6, maxZoom: 12 });
  }

  // Compute full extent of all features for final zoom
  const features = this.tempSource?.getFeatures() || [];
  const projectedCoords: [number, number][] = features.map(f => {
    const geom = f.getGeometry();
    if (!geom) return [0, 0] as [number, number];
    return (geom as any).getCoordinates() as [number, number];
  });

  if (projectedCoords.length > 1) {
    let extent = boundingExtent([projectedCoords[0], projectedCoords[0]]);
    projectedCoords.forEach(c => extendExtent(extent, c));
    this.map?.getView().fit(extent, { padding: [50, 50, 50, 50], maxZoom: 12, duration: 800 });
  }

  // Save layer
  const preferredName = results[0]?.name || prompt;
  const sanitizedName = preferredName.trim().replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_');
  await this.saveAsync(`${sanitizedName}-AI`);
}

  protected override onActivate(): void {
    if (!this.map || !this.tempSource || !this.activeLayer) return;
    this.aiResults = [];
  }

  protected override onDeactivate(): void {
    this.aiResults = [];
  }


  addPoints(coords: [number, number][]) {
    if (!this.tempSource) return;

    coords.forEach(c => {
      const f = this.createFeature(this.createPoint(c), 'point');
      this.tempSource?.addFeature(f);
    });
  }

  async runAIQuery(prompt: string): Promise<AIResult[]> {
    if (!prompt || !this.map) return [];

    const currentPlanet = this.layerManager.currentPlanet;
    const promptWithPlanet = `${prompt} on ${currentPlanet}`;

    try {
      this.layerManager.startExternalLoad('Connecting to AI...');
      await new Promise(r => setTimeout(r, 100));

      const res = await this.http
        .get<any>(`https://gazawayj.pythonanywhere.com/search?q=${encodeURIComponent(promptWithPlanet)}`)
        .toPromise();

      const resultsArray: AIResult[] = Array.isArray(res) ? res : [res];
      this.layerManager.endExternalLoad();
      this.layerManager.startExternalLoad('Deciphering results...');

      this.aiResults = resultsArray
        .filter(r => typeof r.lat === 'number' && typeof r.lon === 'number')
        .map(r => ({ ...r, selected: true }));

      if (!this.aiResults.length) alert('No AI features found for this query.');

      return this.aiResults;
    } catch (err) {
      console.error('AI: Error connecting to server', err);
      alert('AI query failed. Check console for details.');
      return [];
    } finally {
      this.layerManager.endExternalLoad();
    }
  }
}