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

    // Query the AI backend
    const results = await this.runAIQuery(prompt);
    if (!results.length) return;

    // Collect coordinates and names
    const coords: [number, number][] = [];
    const names: string[] = [];

    results
      .filter(r => typeof r.lat === 'number' && typeof r.lon === 'number')
      .forEach(r => {
        coords.push([r.lon, r.lat]);
        names.push(r.name);
      });

    if (!coords.length) return;

    // Draw points with labels
    this.addPoints(coords, names);

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

    // Save layer with sanitized name
    const baseLayerName = 'AI Analysis';
    const timestamp = Date.now();
    const sanitizedName = baseLayerName.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_');
    await this.saveAsync(`${sanitizedName}_${timestamp}`);
  }

  protected override onActivate(): void {
    if (!this.map || !this.tempSource || !this.activeLayer) return;
    this.aiResults = [];
  }

  protected override onDeactivate(): void {
    this.aiResults = [];
  }


  addPoints(coords: [number, number][], names?: string[]) {
    if (!this.tempSource) return;

    coords.forEach((c, i) => {
      const name = names?.[i];

      // Create the point feature
      const pointFeature = this.createFeature(this.createPoint(c), 'point');
      this.tempSource?.addFeature(pointFeature);

      // If we have a name, also create a label feature
      if (name) {
        const labelFeature = this.createFeature(
          this.createPoint(c),
          'label',
          name,       // text for the label
          pointFeature // parentFeature
        );
        this.tempSource?.addFeature(labelFeature);
      }
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