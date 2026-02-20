import { Component, Output, EventEmitter } from '@angular/core';
import { ToolType } from './services/tool.service';

// PURE UI COMPONENT FOR EXPOSING THE TOOLBOX
@Component({
  selector: 'app-toolbox',
  standalone: true,
  template: `
    <button (click)="select('distance')">Distance</button>
  `
})
export class ToolboxComponent {

  @Output() toolSelected = new EventEmitter<ToolType>();

  select(tool: ToolType) {
    this.toolSelected.emit(tool);
  }
}
