/**
 * @file map.component.spec.ts
 * @description Unit tests for MapComponent (standalone) utilizing Vitest, Domino, and OpenLayers mocks.
 */

import '../../test-setup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MapComponent } from './map.component';
import { MapFacadeService } from './services/map-facade.service';
import { LayerManagerService } from './services/layer-manager.service';
import { ToolService } from './services/tool.service';
import { ModalFactoryService } from './factories/modal.factory';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { ElementRef } from '@angular/core';
import { of, NEVER } from 'rxjs';
import { MockHttpClient } from './testing/test-harness';
import { HttpClient } from '@angular/common/http';

describe('MapComponent', () => {
  let component: MapComponent;
  let fixture: ComponentFixture<MapComponent>;

  let mapFacadeMock: any;
  let layerManagerMock: any;
  let toolServiceMock: any;
  let modalFactoryMock: any;

  beforeEach(async () => {
    /**
     * Prevents "Cannot configure the test module when the test module has already been instantiated"
     */
    TestBed.resetTestingModule();

    mapFacadeMock = {
      getCurrentPlanet: vi.fn(() => 'mars'),
      initMap: vi.fn(),
      registerContextMenuHandler: vi.fn(),
      pointerState$: of({ lat: 0, lon: 0, zoom: 2 }),
      mapSingleClick$: NEVER,
      hoverFeature$: of(),
      getActivePlugin: vi.fn(() => ({ name: 'Plugin1' })),
      saveByActivePlugin: vi.fn(() => ({ id: '1', name: 'Layer', planet: 'mars' })),
      cancelActivePlugin: vi.fn(),
      activateTool: vi.fn(),
      getFeatureAtPixel: vi.fn(() => null),
    };

    layerManagerMock = {
      layers$: of([]),
      loading$: of(false),
      loadingMessage$: of(''),
      toggle: vi.fn(),
      remove: vi.fn(),
      reorderLayers: vi.fn(),
      refreshLayersForPlanet: vi.fn(),
      styleService: { setLayerShape: vi.fn() },
      getLayerForFeature: vi.fn(() => null),
      applyHoverStyle: vi.fn(),
      resetFeatureStyle: vi.fn(),
    };

    toolServiceMock = {
      setActiveTool: vi.fn(),
      clearTool: vi.fn(),
      createPlugin: vi.fn(),
      regularTools: [],
      aiTools: [],
    };

    modalFactoryMock = {
      open: vi.fn(() => ({
        backdropClick: () => of(),
        dispose: vi.fn(),
      })),
      close: vi.fn(),
      overlay: {
        position: () => ({
          global: () => ({
            left: () => ({ top: () => ({}) }),
            centerHorizontally: () => ({ centerVertically: () => ({}) }),
          }),
        }),
      },
    } as any;

    /**
     * Configure Module (Without standalone component in imports)
     */
    TestBed.configureTestingModule({
      imports: [
        CommonModule,
        FormsModule,
        DragDropModule
      ],
      providers: [
        { provide: MapFacadeService, useValue: mapFacadeMock },
        { provide: LayerManagerService, useValue: layerManagerMock },
        { provide: ToolService, useValue: toolServiceMock },
        { provide: ModalFactoryService, useValue: modalFactoryMock },
        { provide: HttpClient, useClass: MockHttpClient },
      ],
    });

    /**
     * Override Standalone Component Metadata
     */
    TestBed.overrideComponent(MapComponent, {
      set: {
        template: `
          <div #mapContainer></div>
          <textarea #aiPromptTextarea></textarea>
        `,
        styleUrls: [],
        imports: [CommonModule, FormsModule, DragDropModule] 
      }
    });

    await TestBed.compileComponents();

    fixture = TestBed.createComponent(MapComponent);
    component = fixture.componentInstance;

    // ViewChild Simulation
    component.mapContainer = new ElementRef(document.createElement('div'));
    component.aiPromptTextarea = new ElementRef(document.createElement('textarea'));

    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
    expect(mapFacadeMock.initMap).toHaveBeenCalled();
  });

  it('should open Add Layer modal', () => {
    component.onAddLayer();
    expect(modalFactoryMock.open).toHaveBeenCalled();
  });

  it('should toggle layer visibility', () => {
    const layer = { id: '1', visible: true, planet: 'mars' } as any;
    component.toggleLayer(layer);
    expect(layerManagerMock.toggle).toHaveBeenCalledWith(layer);
  });

  it('should call drag order update on layer drop', () => {
    const layer1 = { id: '1' } as any;
    const layer2 = { id: '2' } as any;
    component.dragOrder = [layer1, layer2];
    component.onLayerDropped({ previousIndex: 0, currentIndex: 1 } as any);
    expect(layerManagerMock.reorderLayers).toHaveBeenCalled();
  });

  it('should open AI modal and handle textarea focus', async () => {
    const focusSpy = vi.fn();
    component.aiPromptTextarea = { nativeElement: { focus: focusSpy } } as any;
    
    component.openAiFeatureFindModal();
    expect(component.aiModalRef).toBeDefined();
    
    await Promise.resolve(); 
    expect(focusSpy).toHaveBeenCalled();
  });

  it('should open plugin save modal', () => {
    component.openPluginSaveModal();
    expect(component.pluginModalRef).toBeDefined();
    expect(component.pluginLayerName).toBeDefined();
  });

  it('should confirm plugin save', () => {
    component.pluginModalRef = {} as any;
    component.confirmSavePlugin('Test Name');
    expect(toolServiceMock.clearTool).toHaveBeenCalled();
    expect(modalFactoryMock.close).toHaveBeenCalled();
  });
});
