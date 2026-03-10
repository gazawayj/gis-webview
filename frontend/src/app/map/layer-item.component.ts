import { Component, Input, Output, EventEmitter, TemplateRef, ViewChild, ViewContainerRef } from '@angular/core';
import { SHAPES, ShapeType } from './constants/symbol-constants';
import { ConnectedPosition, Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-layer-item',
  imports: [CommonModule, FormsModule, DragDropModule],
  templateUrl: './layer-item.component.html',
  styleUrls: ['./layer-item.component.css'],
})
export class LayerItemComponent {
  /** The layer represented by this item */
  @Input() layer!: { name: string; color: string; shape?: ShapeType };

  // Filtered shapes for dropdown (exclude 'line')
  dropdownShapes: ShapeType[] = SHAPES.filter(shape => shape !== 'line');

  /** Emitted when the layer color changes */
  @Output() colorPicked = new EventEmitter<string>();

  /** Emitted when the layer shape is selected */
  @Output() shapeSelected = new EventEmitter<ShapeType>();

  /** Shape dropdown template reference */
  @ViewChild('shapeDropdown') shapeDropdown!: TemplateRef<any>;

  /** Overlay reference for dropdown */
  private overlayRef?: OverlayRef;

  constructor(private overlay: Overlay, private viewContainerRef: ViewContainerRef) { }

  /** Handle color input change */
  onColorPicked(event: Event) {
    const input = event.target as HTMLInputElement;
    this.colorPicked.emit(input.value);
  }

  /** Handle shape selection */
  selectShape(shape: ShapeType) {
    this.shapeSelected.emit(shape);
    this.overlayRef?.detach();
  }

  /** Handle right-click on layer */
  onRightClick(event: MouseEvent) {
    event.preventDefault();
    console.log('Right-clicked layer:', this.layer.name);
  }

  /** Open the shape dropdown overlay */
  openShapeDropdown() {
    if (this.overlayRef) {
      this.overlayRef.detach();
    }

    // Correctly typed position
    const positions: ConnectedPosition[] = [
      {
        originX: 'start',  // must be "start" | "center" | "end"
        originY: 'bottom', // must be "top" | "center" | "bottom"
        overlayX: 'start',
        overlayY: 'top',
        offsetY: 0
      }
    ];

    this.overlayRef = this.overlay.create({
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-transparent-backdrop',
      positionStrategy: this.overlay.position()
        .flexibleConnectedTo(this.viewContainerRef.element)
        .withPositions(positions)
        .withPush(true)
    });

    const portal = new TemplatePortal(this.shapeDropdown, this.viewContainerRef);
    this.overlayRef.attach(portal);

    this.overlayRef.backdropClick().subscribe(() => this.overlayRef?.detach());
  }

  /**
 * Returns normalized points string for SVG polygon shapes
 * @param shape ShapeType
 */
  getPoints(shape: ShapeType): string {
    switch (shape) {
      case 'triangle': return '10,3 3,17 17,17';
      case 'diamond': return '10,3 17,10 10,17 3,10';
      case 'pentagon': return '10,3 17,8 14,17 6,17 3,8';
      case 'hexagon': return '10,3 17,7 17,13 10,17 3,13 3,7';
      case 'star': return '10,3 12,8 18,8 13,12 15,17 10,14 5,17 7,12 2,8 8,8';
      case 'arrow': return '3,10 10,3 10,7 17,7 17,13 10,13 10,17';
      default: return '';
    }
  }
}