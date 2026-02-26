import { Component, Output, EventEmitter } from '@angular/core';
import { ToolType } from './services/tool.service';

@Component({
  selector: 'app-toolbox',
  standalone: true,
  template: `
    <button (click)="select('coordinate')">Coordinate</button>
    <button (click)="select('distance')">Distance</button>
    <button (click)="select('area')">Area</button>
  `
})
export class ToolboxComponent {

  @Output() toolSelected = new EventEmitter<ToolType>();

  select(tool: ToolType) {
    this.toolSelected.emit(tool);
  }
}
