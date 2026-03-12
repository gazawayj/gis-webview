/**
 * @file modal-factory.service.spec.ts
 * @description Unit tests for ModalFactoryService.
 * Tests modal opening, configuration, and backdrop interactions.
 */

import '../../../test-setup';
import { TestBed } from '@angular/core/testing';
import { ModalFactoryService, ModalOptions } from './modal.factory';
import { Overlay, OverlayModule, OverlayRef } from '@angular/cdk/overlay';
import { TemplateRef, ViewContainerRef } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Subject } from 'rxjs';

describe('ModalFactoryService', () => {
  let service: ModalFactoryService;
  let mockOverlay: any;
  let mockOverlayRef: any;
  let backdropClickSubject: Subject<void>;

  beforeEach(() => {
    TestBed.resetTestingModule();
    backdropClickSubject = new Subject<void>();

    // Mock OverlayRef returned by overlay.create()
    mockOverlayRef = {
      attach: vi.fn(),
      dispose: vi.fn(),
      backdropClick: vi.fn(() => backdropClickSubject.asObservable())
    };

    // Mock Overlay service
    mockOverlay = {
      create: vi.fn(() => mockOverlayRef),
      position: vi.fn(() => ({
        global: vi.fn().mockReturnThis(),
        centerHorizontally: vi.fn().mockReturnThis(),
        centerVertically: vi.fn().mockReturnThis()
      })),
      scrollStrategies: {
        block: vi.fn()
      }
    };

    TestBed.configureTestingModule({
      imports: [OverlayModule],
      providers: [
        ModalFactoryService,
        { provide: Overlay, useValue: mockOverlay }
      ]
    });

    service = TestBed.inject(ModalFactoryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should open a modal with default configuration', () => {
    const options: ModalOptions = {
      template: {} as TemplateRef<any>,
      vcr: { element: { nativeElement: {} } } as ViewContainerRef
    };

    const ref = service.open(options);

    expect(mockOverlay.create).toHaveBeenCalled();
    expect(mockOverlayRef.attach).toHaveBeenCalled();
    expect(ref).toBe(mockOverlayRef);
  });

  it('should use custom panelClass if provided', () => {
    const options: ModalOptions = {
      template: {} as TemplateRef<any>,
      vcr: {} as any,
      panelClass: 'custom-modal-class'
    };

    service.open(options);

    const config = mockOverlay.create.mock.calls[0][0];
    expect(config.panelClass).toBe('custom-modal-class');
  });

  it('should dispose modal on backdrop click by default', () => {
    const options: ModalOptions = {
      template: {} as TemplateRef<any>,
      vcr: {} as any
    };

    service.open(options);
    
    // Simulate backdrop click
    backdropClickSubject.next();

    expect(mockOverlayRef.dispose).toHaveBeenCalled();
  });

  it('should NOT dispose modal on backdrop click if hasBackdrop is false', () => {
    const options: ModalOptions = {
      template: {} as TemplateRef<any>,
      vcr: {} as any,
      hasBackdrop: false
    };

    service.open(options);
    backdropClickSubject.next();

    expect(mockOverlayRef.dispose).not.toHaveBeenCalled();
  });

  it('should close a modal via the close() method', () => {
    service.close(mockOverlayRef as OverlayRef);
    expect(mockOverlayRef.dispose).toHaveBeenCalled();
  });

  it('should handle undefined overlayRef in close() gracefully', () => {
    expect(() => service.close(undefined)).not.toThrow();
  });
});
