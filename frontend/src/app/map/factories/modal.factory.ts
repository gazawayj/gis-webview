import { Injectable, TemplateRef, ViewContainerRef } from '@angular/core';
import { Overlay, OverlayRef, OverlayConfig } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';

export interface ModalOptions {
  template: TemplateRef<any>;
  vcr: ViewContainerRef; 
  backdropClass?: string;
  hasBackdrop?: boolean;
  panelClass?: string;
  width?: string;
  height?: string;
  positionStrategy?: any; 
}

@Injectable({ providedIn: 'root' })
export class ModalFactoryService {
  constructor(private overlay: Overlay) {}

  /**
   * Open a modal using an Overlay + TemplatePortal.
   * Must pass the ViewContainerRef from the calling component.
   */
  open(options: ModalOptions): OverlayRef {
    const overlayRef = this.overlay.create(this.getOverlayConfig(options));

    const portal = new TemplatePortal(options.template, options.vcr);
    overlayRef.attach(portal);

    // Close modal when backdrop is clicked
    if (options.hasBackdrop !== false) {
      overlayRef.backdropClick().subscribe(() => overlayRef.dispose());
    }

    return overlayRef;
  }

  /**
   * Close a modal by disposing the overlay
   */
  close(overlayRef?: OverlayRef) {
    overlayRef?.dispose();
  }

  /**
   * Build OverlayConfig with defaults
   */
  private getOverlayConfig(options: ModalOptions): OverlayConfig {
    return new OverlayConfig({
      hasBackdrop: options.hasBackdrop ?? true,
      backdropClass: options.backdropClass ?? 'cdk-overlay-dark-backdrop',
      panelClass: options.panelClass ?? 'modal-panel',
      width: options.width ?? '400px',
      height: options.height ?? 'auto',
      positionStrategy:
        options.positionStrategy ??
        this.overlay.position().global().centerHorizontally().centerVertically(),
      scrollStrategy: this.overlay.scrollStrategies.block(),
    });
  }
}