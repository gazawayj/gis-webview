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
  constructor(private overlay: Overlay) { }

  /**
   * Open a modal using an Overlay + TemplatePortal.
   * Must pass the ViewContainerRef from the calling component.
   */
  open(options: ModalOptions): OverlayRef {
    // Use provided panelClass or default to 'layer-modal' for modals
    const panelClass = options.panelClass ?? 'layer-modal';

    const overlayRef = this.overlay.create(this.getOverlayConfig({
      ...options,
      panelClass,
    }));

    // Attach template portal
    const portal = new TemplatePortal(options.template, options.vcr);
    overlayRef.attach(portal);

    // Close modal when backdrop is clicked
    if (options.hasBackdrop !== false) {
      overlayRef.backdropClick().subscribe(() => overlayRef.dispose());
    }

    return overlayRef;
  }

  close(overlayRef?: OverlayRef) {
    overlayRef?.dispose();
  }

  private getOverlayConfig(options: ModalOptions): OverlayConfig {
    return new OverlayConfig({
      hasBackdrop: options.hasBackdrop ?? true,
      backdropClass: options.backdropClass ?? 'cdk-overlay-dark-backdrop',
      panelClass: options.panelClass,
      width: options.width ?? 'auto',
      height: options.height ?? 'auto',
      positionStrategy:
        options.positionStrategy ??
        this.overlay.position().global().centerHorizontally().centerVertically(),
      scrollStrategy: this.overlay.scrollStrategies.block(),
    });
  }
}