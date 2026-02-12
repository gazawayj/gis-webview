import { Component, ElementRef, Input, TemplateRef, ViewChild, ViewContainerRef } from '@angular/core';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-layer-item',
  templateUrl: './layer-item.component.html',
  imports: [CommonModule],
  styleUrls: ['./layer-item.component.css']
})
export class LayerItemComponent {
  @Input() layer!: { name: string; [key: string]: any };

  @ViewChild('shapeDropdown') shapeDropdown!: TemplateRef<any>;

  shapes = ['Circle', 'Square', 'Triangle'];
  selectedShape = 'Circle';
  overlayRef!: OverlayRef;

  constructor(
    private overlay: Overlay,
    private vcr: ViewContainerRef,
    private elRef: ElementRef
  ) {}

  /** Checkbox-only toggle for layer visibility */
  onLayerCheckboxClick(layer: any, event: MouseEvent) {
    layer['visible'] = !layer['visible'];
    event.stopPropagation();
  }

  /** Open the floating shape dropdown using Angular CDK overlay */
  openShapeDropdown() {
    // Close previous overlay if exists
    if (this.overlayRef) {
      this.overlayRef.dispose();
    }

    // Position the overlay below the "Shape" button
    const buttonEl = this.elRef.nativeElement.querySelector('.shape-selected-button');
    if (!buttonEl) return;

    const positionStrategy = this.overlay.position()
      .flexibleConnectedTo(buttonEl)
      .withPositions([{
        originX: 'center',
        originY: 'bottom',
        overlayX: 'center',
        overlayY: 'top'
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

  /** Select a shape from the dropdown */
  selectShape(shape: string) {
    this.selectedShape = shape;
    if (this.overlayRef) {
      this.overlayRef.dispose();
    }
  }
}
