import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  TemplateRef,
  ViewChild,
  ViewContainerRef,
  CUSTOM_ELEMENTS_SCHEMA
} from '@angular/core';
import { CommonModule, NgIf, NgForOf } from '@angular/common';
import { SHAPES, ShapeType } from './services/symbol-constants';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { inject } from '@angular/core';

export interface LayerItem {
  name: string;
  visible: boolean;
  color: string;
  shape: ShapeType;
}

@Component({
  selector: 'app-layer-item',
  standalone: true,
  imports: [CommonModule, NgIf, NgForOf],
  templateUrl: './layer-item.component.html',
  styleUrls: ['./layer-item.component.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA] // <-- allow SVG elements like circle, rect, polygon, line
})
export class LayerItemComponent {
  @Input() layer!: LayerItem;

  @Output() visibilityChange = new EventEmitter<boolean>();
  @Output() colorChange = new EventEmitter<string>();
  @Output() shapeChange = new EventEmitter<ShapeType>();
  @Output() remove = new EventEmitter<void>();

  @ViewChild('shapeDropdown', { static: true })
  shapeDropdown!: TemplateRef<any>;

  shapes: ShapeType[] = [...SHAPES]; // include 'line'

  private overlayRef!: OverlayRef;

  private overlay = inject(Overlay);
  private vcr = inject(ViewContainerRef);
  private elRef = inject(ElementRef);

  toggleVisibility(event: MouseEvent) {
    event.stopPropagation();
    this.visibilityChange.emit(!this.layer.visible);
  }

  onColorPicked(event: Event) {
    const value = (event.target as HTMLInputElement)?.value;
    if (value) this.colorChange.emit(value);
  }

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

  get dropdownShapes(): ShapeType[] {
    // exclude 'line' from normal layer dropdown
    return this.shapes.filter(s => s !== 'line');
  }

  selectShape(shape: ShapeType) {
    this.shapeChange.emit(shape);
    if (this.overlayRef) this.overlayRef.dispose();
  }

  getPoints(shape: string): string {
    const map: Record<string, string> = {
      triangle: '10,4 16,16 4,16',
      diamond: '10,2 18,10 10,18 2,10',
      pentagon: '10,2 18,8 14,18 6,18 2,8',
      hexagon: '10,2 16,6 16,14 10,18 4,14 4,6',
      star: '10,2 12,8 18,8 13,12 15,18 10,14 5,18 7,12 2,8 8,8',
      arrow: '10,2 16,10 12,10 12,18 8,18 8,10 4,10'
    };
    return map[shape.toLowerCase()] || '';
  }
}