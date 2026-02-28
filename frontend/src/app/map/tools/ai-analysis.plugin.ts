import { ToolPluginBase } from './tool-base.plugin';
import { LayerManagerService } from '../services/layer-manager.service';

export class AIAnalysisPlugin extends ToolPluginBase {
  name = 'ai-analysis';

  constructor(layerManager: LayerManagerService) {
    super(layerManager);
  }

  protected onActivate(): void {
    console.log('AI Analysis tool activated');
  }

  protected override onDeactivate(): void {
    console.log('AI Analysis tool deactivated');
  }

  protected override onSave(layer: any): void {
    console.log('AI Analysis tool saved layer', layer);
  }
}
