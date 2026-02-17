import { Component, ElementRef, EventEmitter, Input, Output, TemplateRef, ViewChild, ViewContainerRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';

export interface LayerItem {
  name: string;
  visible: boolean;
  color: string;
  shape: string;
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
  @Output() shapeChange = new EventEmitter<string>();
  @Output() remove = new EventEmitter<void>();

  @ViewChild('shapeDropdown', { static: true }) shapeDropdown!: TemplateRef<any>;
  shapes = ['Circle', 'Square', 'Triangle', 'Diamond', 'Pentagon', 'Hexagon', 'Star', 'Arrow'];
  private overlayRef!: OverlayRef;

  constructor(private overlay: Overlay, private vcr: ViewContainerRef, private elRef: ElementRef) { }

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
        originY: 'top',
        overlayX: 'start',
        overlayY: 'center',
        offsetX: 4
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

  selectShape(shape: string) {
    this.shapeChange.emit(shape.toLowerCase());
    if (this.overlayRef) this.overlayRef.dispose();
  }
}
