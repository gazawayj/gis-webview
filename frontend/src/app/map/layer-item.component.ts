import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  TemplateRef,
  ViewChild,
  ViewContainerRef,
  OnDestroy,
  CUSTOM_ELEMENTS_SCHEMA,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SHAPES, ShapeType } from './constants/symbol-constants';
import { LayerConfig } from './models/layer-config.model';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';

@Component({
  selector: 'app-layer-item',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './layer-item.component.html',
  styleUrls: ['./layer-item.component.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class LayerItemComponent implements OnDestroy {
  /** Input layer configuration for this item */
  @Input() layer!: LayerConfig;

  /** Emits when the layer visibility toggle is clicked */
  @Output() itemToggle = new EventEmitter<void>();

  /** Emits when the user selects a new color */
  @Output() colorPicked = new EventEmitter<string>();

  /** Emits when the user selects a new shape */
  @Output() shapeSelected = new EventEmitter<ShapeType>();

  /** Emits when the remove action is triggered */
  @Output() remove = new EventEmitter<void>();

  /** Template reference for the shape dropdown overlay */
  @ViewChild('shapeDropdown', { static: true }) shapeDropdown!: TemplateRef<any>;

  /** Available shapes for the dropdown */
  shapes: ShapeType[] = [...SHAPES];

  /** Reference to the currently active overlay */
  private overlayRef?: OverlayRef;

  /** Angular CDK Overlay service */
  private overlay = inject(Overlay);

  /** Angular ViewContainerRef for TemplatePortal */
  private vcr = inject(ViewContainerRef);

  /** Reference to this component's host element */
  private elRef = inject(ElementRef);

  /**
   * Toggles the visibility of this layer and emits an event.
   * @param event Mouse event from the UI click
   */
  toggleVisibility(event: MouseEvent): void {
    event.stopPropagation();
    this.itemToggle.emit();
  }

  /**
   * Emits the color picked from a color input.
   * @param event Color input change event
   */
  onColorPicked(event: Event): void {
    const value = (event.target as HTMLInputElement)?.value;
    if (value) this.colorPicked.emit(value);
  }

  /**
   * Opens the shape selection dropdown overlay.
   * Disposes any existing overlay before opening a new one.
   */
  openShapeDropdown(): void {
    this.disposeOverlay();

    const buttonEl: HTMLElement | null =
      this.elRef.nativeElement.querySelector('.shape-selected-button');
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

    // Close overlay when backdrop is clicked
    this.overlayRef.backdropClick().subscribe(() => this.disposeOverlay());

    const portal = new TemplatePortal(this.shapeDropdown, this.vcr);
    this.overlayRef.attach(portal);
  }

  /**
   * Disposes the overlay safely if it exists.
   */
  private disposeOverlay(): void {
    if (this.overlayRef) {
      this.overlayRef.dispose();
      this.overlayRef = undefined;
    }
  }

  /**
   * Returns available shapes for the dropdown, excluding line types.
   */
  get dropdownShapes(): ShapeType[] {
    return this.shapes.filter(t => !t.includes('line'));
  }

  /**
   * Emits the selected shape and closes the dropdown overlay.
   * @param shape The shape selected by the user
   */
  selectShape(shape: ShapeType): void {
    this.shapeSelected.emit(shape);
    this.disposeOverlay();
  }

  /**
   * Maps a shape name to its corresponding SVG points string.
   * @param shape Shape name (e.g., 'triangle', 'star')
   * @returns SVG points string for rendering the shape
   */
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

  /**
   * Angular lifecycle hook to clean up the overlay when component is destroyed.
   */
  ngOnDestroy(): void {
    this.disposeOverlay();
  }
}