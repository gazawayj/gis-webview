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
  @Input() layer!: LayerConfig;

  @Output() toggle = new EventEmitter<void>();
  @Output() colorPicked = new EventEmitter<string>();
  @Output() shapeSelected = new EventEmitter<ShapeType>();
  @Output() remove = new EventEmitter<void>();

  @ViewChild('shapeDropdown', { static: true }) shapeDropdown!: TemplateRef<any>;

  shapes: ShapeType[] = [...SHAPES];

  private overlayRef?: OverlayRef;

  private overlay = inject(Overlay);
  private vcr = inject(ViewContainerRef);
  private elRef = inject(ElementRef);

  /** Toggle layer visibility */
  toggleVisibility(event: MouseEvent): void {
    event.stopPropagation();
    this.toggle.emit();
  }

  /** Emit color picked */
  onColorPicked(event: Event): void {
    const value = (event.target as HTMLInputElement)?.value;
    if (value) this.colorPicked.emit(value);
  }

  /** Open shape dropdown overlay */
  openShapeDropdown(): void {
    // Dispose existing overlay
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

    this.overlayRef.backdropClick().subscribe(() => this.disposeOverlay());

    const portal = new TemplatePortal(this.shapeDropdown, this.vcr);
    this.overlayRef.attach(portal);
  }

  /** Dispose overlay safely */
  private disposeOverlay(): void {
    if (this.overlayRef) {
      this.overlayRef.dispose();
      this.overlayRef = undefined;
    }
  }

  /** Dropdown options */
  get dropdownShapes(): (ShapeType)[] {
    return this.shapes.filter(t => !t.includes('line'));
  }

  /** Emit selected shape and close overlay */
  selectShape(shape: ShapeType): void {
    this.shapeSelected.emit(shape);
    this.disposeOverlay();
  }

  /** Map shape name to SVG points */
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

  ngOnDestroy(): void {
    this.disposeOverlay();
  }
}