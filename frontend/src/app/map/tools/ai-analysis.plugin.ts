import Feature from 'ol/Feature';
import { ToolPluginBase } from './tool-base.plugin';
import { HttpClient } from '@angular/common/http';
import { LayerManagerService } from '../services/layer-manager.service';
import { StyleService } from '../services/style.service';
import { boundingExtent, extend as extendExtent } from 'ol/extent';
// Added OpenLayers Style imports
import { Style, Fill, Stroke } from 'ol/style';

/**
 * AI-based analysis tool plugin.
 * Queries an AI server for features matching a user prompt and plots points/labels on the map.
 */
export interface AIResult {
  /** Feature name returned from AI */
  name: string;

  /** Latitude in decimal degrees */
  lat: number;

  /** Longitude in decimal degrees */
  lon: number;

  /** Planet string: 'earth' | 'moon' | 'mars' */
  planet: string;

  /** Optional descriptive details */
  details: string;
}

export class AIAnalysisPlugin extends ToolPluginBase {
  /** Tool type identifier */
  name = 'ai-analysis';
  private aiResults: AIResult[] = [];

  constructor(
    layerManager: LayerManagerService,
    private http: HttpClient,
    private styleService: StyleService
  ) {
    super(layerManager);
  }

  /**
   * Executes an AI query and plots results on the map.
   * @param prompt Text query to send to AI server
   */
  async execute(prompt: string): Promise<void> {
    if (!prompt) return;

    const results = await this.runAIQuery(prompt);
    if (!results.length) return;

    const coords: [number, number][] = [];
    const names: string[] = [];
    const details: string[] = [];

    results
      .filter(r => typeof r.lat === 'number' && typeof r.lon === 'number')
      .forEach(r => {
        coords.push([r.lon, r.lat]);
        names.push(r.name);
        details.push(r.details ?? '');
      });

    if (!coords.length) return;

    this.addPoints(coords, names, details);

    for (const c of coords) {
      await this.flyToCoordinates([c], { minZoom: 6, maxZoom: 12 });
    }

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

    const baseLayerName = 'AI Analysis';
    const timestamp = Date.now();
    const sanitizedName = baseLayerName.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_');
    await this.saveAsync(`${sanitizedName}_${timestamp}`);
  }

  /** Hook called on tool activation */
  protected override onActivate(): void {
    if (!this.map || !this.tempSource || !this.activeLayer) return;
    this.aiResults = [];
  }

  /** Hook called on tool deactivation */
  protected override onDeactivate(): void {
    this.aiResults = [];
  }

  /**
   * Adds point features to the temporary layer.
   * Creates both point and optional label features.
   * @param coords Array of [lon, lat] positions
   * @param names Optional array of names for labels
   * @param details Optional array of detail strings
   */
  addPoints(coords: [number, number][], names?: string[], details?: string[]) {
    if (!this.tempSource) return;

    // Define the transparent style
    const transparentStyle = new Style({
      fill: new Fill({
        color: 'rgba(0, 0, 0, 0)' // Fully transparent fill
      }),
      stroke: new Stroke({
        color: '#3399CC', // Blue outline so you can still see the shape
        width: 1
      })
    });

    coords.forEach((c, i) => {
      const name = names?.[i];
      const detail = details?.[i];

      const pointFeature = this.createFeature(this.createPoint(c), 'point');
      if (detail) pointFeature.set('details', detail);

      // Apply the transparent style here
      pointFeature.setStyle(transparentStyle);

      this.tempSource?.addFeature(pointFeature);

      if (name) {
        const nameLabelPoint = this.createPoint(c);
        const nameLabel = this.createFeature(
          nameLabelPoint,
          'label',
          name,
          pointFeature
        );
        nameLabel.set('labelPosition', 'top');
        this.tempSource?.addFeature(nameLabel);
      }
    });
  }

  /**
   * Sends the prompt to the AI server and parses results.
   * @param prompt Query string
   * @returns Array of AIResult
   */
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
