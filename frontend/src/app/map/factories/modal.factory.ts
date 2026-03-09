import { inject, Injectable, TemplateRef, ViewContainerRef } from '@angular/core';
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
  private overlay = inject(Overlay);

  /**
   * Opens a modal overlay using the provided template and options.
   * @param options Modal configuration
   * @returns OverlayRef for controlling the modal
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

  /**
   * Closes the specified modal overlay.
   * @param overlayRef OverlayRef instance to close
   */
  close(overlayRef?: OverlayRef) {
    overlayRef?.dispose();
  }

  /**
   * Generates an OpenLayers OverlayConfig based on ModalOptions.
   * @param options Modal configuration
   * @returns OverlayConfig object for overlay creation
   */
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
