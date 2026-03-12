/**
 * @file layer-item.component.spec.ts
 * @description Unit tests for LayerItemComponent.
 */

import '../../test-setup';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LayerItemComponent } from './layer-item.component';
import { Overlay, OverlayModule } from '@angular/cdk/overlay';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';

describe('LayerItemComponent', () => {
  let component: LayerItemComponent;
  let fixture: ComponentFixture<LayerItemComponent>;
  let mockOverlay: any;

  beforeEach(async () => {
    /**
     * Clear previous configurations to ensure clean state
     */
    TestBed.resetTestingModule();

    mockOverlay = {
      create: vi.fn(() => ({
        attach: vi.fn(),
        detach: vi.fn(),
        dispose: vi.fn(),
        backdropClick: vi.fn(() => of()),
        positionStrategy: { setOrigin: vi.fn() }
      })),
      position: vi.fn(() => ({
        flexibleConnectedTo: vi.fn().mockReturnThis(),
        withPositions: vi.fn().mockReturnThis(),
        withPush: vi.fn().mockReturnThis()
      }))
    };

    /**
     * Configure Testing Module WITHOUT the component in imports
     */
    TestBed.configureTestingModule({
      imports: [
        CommonModule, 
        FormsModule, 
        DragDropModule, 
        OverlayModule
      ],
      providers: [
        { provide: Overlay, useValue: mockOverlay }
      ]
    });

    /**
     * Override Component Metadata to bypass external file loading
     */
    TestBed.overrideComponent(LayerItemComponent, {
      set: {
        template: `<div></div>`,
        styleUrls: [],
        imports: [CommonModule, FormsModule, DragDropModule]
      }
    });

    /**
     * Compile
     */
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(LayerItemComponent);
    component = fixture.componentInstance;
    
    // Set mandatory @Input() before first detectChanges
    component.layer = { name: 'Test Layer', color: '#ff0000', shape: 'circle' };
    
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should emit colorPicked when the color input changes', () => {
    const emitSpy = vi.spyOn(component.colorPicked, 'emit');
    const mockEvent = { target: { value: '#00ff00' } } as any;

    component.onColorPicked(mockEvent);

    expect(emitSpy).toHaveBeenCalledWith('#00ff00');
  });

  it('should emit shapeSelected and detach overlay when a shape is selected', () => {
    const emitSpy = vi.spyOn(component.shapeSelected, 'emit');
    const mockOverlayRef = { detach: vi.fn() };
    (component as any).overlayRef = mockOverlayRef;

    component.selectShape('diamond');

    expect(emitSpy).toHaveBeenCalledWith('diamond');
    expect(mockOverlayRef.detach).toHaveBeenCalled();
  });

  it('should return correct SVG points for polygon shapes', () => {
    expect(component.getPoints('triangle')).toBe('10,3 3,17 17,17');
    expect(component.getPoints('star')).toBe('10,3 12,8 18,8 13,12 15,17 10,14 5,17 7,12 2,8 8,8');
  });

  it('should call preventDefault on right-click', () => {
    const mockEvent = { preventDefault: vi.fn() } as any;
    component.onRightClick(mockEvent);
    expect(mockEvent.preventDefault).toHaveBeenCalled();
  });

  it('should create an overlay when opening shape dropdown', () => {
    component.openShapeDropdown();

    expect(mockOverlay.create).toHaveBeenCalled();
    expect(mockOverlay.position).toHaveBeenCalled();
    expect((component as any).overlayRef).toBeDefined();
  });

  it('should filter out "line" from dropdown shapes', () => {
    const hasLine = component.dropdownShapes.includes('line' as any);
    expect(hasLine).toBe(false);
    expect(component.dropdownShapes.length).toBeGreaterThan(0);
  });
});
