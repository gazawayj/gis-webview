import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { ToolPluginBase } from './tool-base.plugin';

export class AIAnalysisPlugin extends ToolPluginBase {
  name = 'ai-analysis';

  // Store generated features before saving
  private generatedFeatures: Feature[] = [];

  constructor(layerManager: any) {
    super(layerManager);
  }

  protected onActivate(): void {
    console.log('AI Analysis tool activated');
  }

  protected override onDeactivate(): void {
    // Clear temporary features
    this.generatedFeatures = [];
    console.log('AI Analysis tool deactivated');
  }

  /**
   * Adds AI-generated points to the tool’s temporary layer
   */
  public addAIPoints(coords: [number, number][]) {
    coords.forEach(c => {
      const f = this.createFeature(new Point(c), 'point');
      this.tempSource?.addFeature(f);
      this.generatedFeatures.push(f);
    });
  }

  /**
   * Save the AI layer permanently via ToolPluginBase.save()
   */
  override onSave(layer: { name: string }) {
    if (!layer.name) return;

    // Use ToolPluginBase.save() to create the permanent LayerConfig
    const savedLayer = this.save(layer.name);

    // Optionally, reset temp features array
    this.generatedFeatures = [];
    console.log('AI Analysis layer saved', savedLayer);
  }
}