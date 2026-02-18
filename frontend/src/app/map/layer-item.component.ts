import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  TemplateRef,
  ViewChild,
  ViewContainerRef
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { SHAPES, ShapeType } from './services/symbol-constants';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';

export interface LayerItem {
  name: string;
  visible: boolean;
  color: string;
  shape: ShapeType | 'none';
}

@Component({
  selector: 'app-layer-item',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './layer-item.component.html',
  styleUrls: ['./layer-item.component.css']
})
export class LayerItemComponent {

  @Input() layer!: LayerItem;

  @Output() visibilityChange = new EventEmitter<boolean>();
  @Output() colorChange = new EventEmitter<string>();
  @Output() shapeChange = new EventEmitter<ShapeType | 'none'>();
  @Output() remove = new EventEmitter<void>();

  @ViewChild('shapeDropdown', { static: true })
  shapeDropdown!: TemplateRef<any>;

  shapes: (ShapeType | 'none')[] = ['none', ...SHAPES];

  private overlayRef!: OverlayRef;

  constructor(
    private overlay: Overlay,
    private vcr: ViewContainerRef,
    private elRef: ElementRef
  ) { }

  // ===== Visibility =====
  toggleVisibility(event: MouseEvent) {
    event.stopPropagation();
    this.visibilityChange.emit(!this.layer.visible);
  }

  // ===== Color Picker =====
  onColorPicked(event: Event) {
    const value = (event.target as HTMLInputElement)?.value;
    if (value) this.colorChange.emit(value);
  }

  // ===== Shape Dropdown =====
  openShapeDropdown() {
    if (this.overlayRef) this.overlayRef.dispose();

    const buttonEl = this.elRef.nativeElement.querySelector('.shape-selected-button');
    if (!buttonEl) return;

    const positionStrategy = this.overlay.position()
      .flexibleConnectedTo(buttonEl)
      .withPositions([{
        originX: 'end',
        originY: 'center',
        overlayX: 'start',
        overlayY: 'center'
      }])
      .withFlexibleDimensions(false)
      .withPush(false);

    this.overlayRef = this.overlay.create({
      positionStrategy,
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-transparent-backdrop',
      scrollStrategy: this.overlay.scrollStrategies.reposition()
    });

    this.overlayRef.backdropClick().subscribe(() => this.overlayRef.dispose());

    const portal = new TemplatePortal(this.shapeDropdown, this.vcr);
    this.overlayRef.attach(portal);
  }

  // ===== Shape Selection =====
  selectShape(shape: ShapeType | 'none') {
    this.shapeChange.emit(shape);
    if (this.overlayRef) this.overlayRef.dispose();
  }
}
