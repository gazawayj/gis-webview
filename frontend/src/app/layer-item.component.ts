import { Component, ElementRef, EventEmitter, Input, Output, TemplateRef, ViewChild, ViewContainerRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';

interface LayerItem {
  name: string;
  visible: boolean;
  color: string;
  shape: string;
}

@Component({
  selector: 'app-layer-item',
  standalone: true,
  imports: [CommonModule],
  template: `
  <div class="layer-item">
    <input type="checkbox" [checked]="layer.visible" (click)="toggleVisibility($event)" />
    <span class="layer-name">{{ layer.name }}</span>
    <input type="color" [value]="layer.color" (input)="onColorPicked($event)" />

    <button class="shape-selected-button" (click)="openShapeDropdown()">
      <svg width="20" height="20">
        <ng-container [ngSwitch]="layer.shape.toLowerCase()">
          <circle *ngSwitchCase="'circle'" cx="10" cy="10" r="6" [attr.fill]="layer.color" stroke="black"/>
          <rect *ngSwitchCase="'square'" x="4" y="4" width="12" height="12" [attr.fill]="layer.color" stroke="black"/>
          <polygon *ngSwitchCase="'triangle'" points="10,4 16,16 4,16" [attr.fill]="layer.color" stroke="black"/>
          <polygon *ngSwitchCase="'diamond'" points="10,2 18,10 10,18 2,10" [attr.fill]="layer.color" stroke="black"/>
          <polygon *ngSwitchCase="'pentagon'" points="10,2 18,8 14,18 6,18 2,8" [attr.fill]="layer.color" stroke="black"/>
          <polygon *ngSwitchCase="'hexagon'" points="10,2 16,6 16,14 10,18 4,14 4,6" [attr.fill]="layer.color" stroke="black"/>
          <polygon *ngSwitchCase="'star'" points="10,2 12,8 18,8 13,12 15,18 10,14 5,18 7,12 2,8 8,8" [attr.fill]="layer.color" stroke="black"/>
          <polygon *ngSwitchCase="'arrow'" points="10,2 16,10 12,10 12,18 8,18 8,10 4,10" [attr.fill]="layer.color" stroke="black"/>
        </ng-container>
      </svg>
    </button>

    <button class="remove-btn" (click)="remove.emit()">✕</button>

    <ng-template #shapeDropdown>
      <div class="shape-dropdown">
        <button *ngFor="let shape of shapes" (click)="selectShape(shape)">
          <svg width="20" height="20">
            <ng-container [ngSwitch]="shape.toLowerCase()">
              <circle *ngSwitchCase="'circle'" cx="10" cy="10" r="6" [attr.fill]="layer.color" stroke="black"/>
              <rect *ngSwitchCase="'square'" x="4" y="4" width="12" height="12" [attr.fill]="layer.color" stroke="black"/>
              <polygon *ngSwitchCase="'triangle'" points="10,4 16,16 4,16" [attr.fill]="layer.color" stroke="black"/>
              <polygon *ngSwitchCase="'diamond'" points="10,2 18,10 10,18 2,10" [attr.fill]="layer.color" stroke="black"/>
              <polygon *ngSwitchCase="'pentagon'" points="10,2 18,8 14,18 6,18 2,8" [attr.fill]="layer.color" stroke="black"/>
              <polygon *ngSwitchCase="'hexagon'" points="10,2 16,6 16,14 10,18 4,14 4,6" [attr.fill]="layer.color" stroke="black"/>
              <polygon *ngSwitchCase="'star'" points="10,2 12,8 18,8 13,12 15,18 10,14 5,18 7,12 2,8 8,8" [attr.fill]="layer.color" stroke="black"/>
              <polygon *ngSwitchCase="'arrow'" points="10,2 16,10 12,10 12,18 8,18 8,10 4,10" [attr.fill]="layer.color" stroke="black"/>
            </ng-container>
          </svg>
        </button>
      </div>
    </ng-template>
  </div>
  `
})
export class LayerItemComponent {
  @Input() layer!: LayerItem;
  @Output() visibilityChange = new EventEmitter<boolean>();
  @Output() colorChange = new EventEmitter<string>();
  @Output() shapeChange = new EventEmitter<string>();
  @Output() remove = new EventEmitter<void>();

  @ViewChild('shapeDropdown') shapeDropdown!: TemplateRef<any>;
  shapes = ['Circle', 'Square', 'Triangle', 'Diamond', 'Pentagon', 'Hexagon', 'Star', 'Arrow'];
  private overlayRef!: OverlayRef;

  constructor(private overlay: Overlay, private vcr: ViewContainerRef, private elRef: ElementRef) { }

  toggleVisibility(event: MouseEvent) {
    event.stopPropagation();
    this.visibilityChange.emit(!this.layer.visible);
  }

  onColorPicked(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.colorChange.emit(value);
  }

  openShapeDropdown() {
    if (this.overlayRef) this.overlayRef.dispose();
    const buttonEl = this.elRef.nativeElement.querySelector('.shape-selected-button');
    if (!buttonEl) return;

    const positionStrategy = this.overlay.position()
      .flexibleConnectedTo(buttonEl)
      .withPositions([{
        originX: 'end',   // right edge of button
        originY: 'top', // vertically center
        overlayX: 'start', // left edge of overlay
        overlayY: 'center', // vertically center overlay
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
