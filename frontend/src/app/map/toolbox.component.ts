import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToolType, ToolDefinition } from './models/tool-definition.model';

@Component({
  selector: 'app-toolbox',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tool-section">
      @if (tools.length) {
        <div class="toolbar-label">{{ label }}</div>
        @for (tool of tools; track tool.type) {
          <button class="tool-btn" (click)="select(tool.type)" [title]="tool.name" [innerHTML]="tool.icon"></button>
        }
      }
    </div>
  `,
  styles: [`
    .tool-section { margin-bottom: 16px; display: flex; flex-direction: column; gap: 4px; }
    .tool-btn { padding: 6px 10px; font-size: 14px; cursor: pointer; text-align: left; }
  `]
})
export class ToolboxComponent {
  @Input() tools: ToolDefinition[] = [];
  @Input() label = 'Toolbox';
  @Output() toolSelected = new EventEmitter<ToolType>();

  select(tool: ToolType) {
    this.toolSelected.emit(tool);
  }
}