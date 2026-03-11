/**
 * map.component.spec.ts
 * 
 * This test suite validates the MapComponent, the central UI controller for the GIS viewer.
 * It manages the OpenLayers map instance, sidebar interactions, and tool integrations.
 * 
 * --- CORE TESTING CONCEPTS USED HERE ---
 * 
 * 1. SHALLOW TESTING: 
 *    Uses `.overrideComponent` to strip away real imports (like LayerItemComponent).
 *    This prevents Vitest from crashing when it can't find external HTML/CSS files 
 *    for child components.
 * 
 * 2. MICROTASK TIMING: 
 *    Since the component uses 'Promise.resolve().then()' for UI focus, we use 
 *    'await Promise.resolve()' in tests to "wait" for that logic to finish.
 * 
 * 3. MANUAL VIEWCHILD MOCKING: 
 *    Angular's @ViewChild is linked to the DOM. In a headless test, we manually 
 *    inject 'ElementRef' objects to simulate map containers and textareas.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MapComponent } from './map.component';
import { MapFacadeService } from './services/map-facade.service';
import { LayerManagerService } from './services/layer-manager.service';
import { ToolService } from './services/tool.service';
import { ModalFactoryService } from './factories/modal.factory';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { of, NEVER } from 'rxjs';
import { NO_ERRORS_SCHEMA, CUSTOM_ELEMENTS_SCHEMA, ElementRef } from '@angular/core';

describe('MapComponent', () => {
  let component: MapComponent;
  let fixture: ComponentFixture<MapComponent>;

  /** 
   * MOCK OBJECTS:
   * Define these as 'any' to avoid strict TypeScript errors while 
   * providing only the specific methods the component actually calls.
   */
  let mapFacadeMock: any;
  let layerManagerMock: any;
  let toolServiceMock: any;
  let modalFactoryMock: any;

  beforeEach(async () => {
    /**
     * MapFacadeService Mock
     * Orchestrates the OpenLayers Map. Mock its Observables so the component
     * can subscribe to pointer and click events safely.
     */
    mapFacadeMock = {
      getCurrentPlanet: vi.fn(() => 'mars' as const),
      initMap: vi.fn(),
      registerContextMenuHandler: vi.fn(),
      pointerState$: of({ lat: 0, lon: 0, zoom: 2 }),
      /** 
       * Use 'NEVER' for the click stream to ensure it doesn't emit 
       * during initialization, which prevents background TypeErrors.
       */
      mapSingleClick$: NEVER, 
      hoverFeature$: of(),
      getActivePlugin: vi.fn(() => ({ name: 'Plugin1' })),
      saveByActivePlugin: vi.fn(() => ({ id: '1', name: 'Layer', planet: 'mars' })),
      cancelActivePlugin: vi.fn(),
      activateTool: vi.fn(),
      getFeatureAtPixel: vi.fn(() => null)
    };

    /**
     * LayerManagerService Mock
     * Handles the sidebar list and OpenLayers layer visibility.
     */
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
      resetFeatureStyle: vi.fn()
    };

    /**
     * ToolService Mock
     * Provides the list of active tools and manages tool state.
     */
    toolServiceMock = {
      setActiveTool: vi.fn(),
      clearTool: vi.fn(),
      createPlugin: vi.fn(),
      regularTools: [],
      aiTools: []
    };

    /**
     * ModalFactoryService Mock
     * Manages popups/modals. 'Overlay' mock; this is required 
     * because the component accesses private 'overlay' members via bracket notation.
     */
    modalFactoryMock = {
      open: vi.fn(() => ({
        backdropClick: () => of(),
        dispose: vi.fn()
      })),
      close: vi.fn(),
      overlay: {
        position: () => ({
          global: () => ({
            left: () => ({ top: () => ({}) }),
            centerHorizontally: () => ({ centerVertically: () => ({}) })
          })
        })
      }
    } as any;

    await TestBed.configureTestingModule({
      imports: [
        CommonModule, 
        FormsModule, 
        DragDropModule, 
        HttpClientTestingModule // Satisfies dependency for http-based tools
      ],
      providers: [
        { provide: MapFacadeService, useValue: mapFacadeMock },
        { provide: LayerManagerService, useValue: layerManagerMock },
        { provide: ToolService, useValue: toolServiceMock },
        { provide: ModalFactoryService, useValue: modalFactoryMock }
      ],
      /**
       * SCHEMAS:
       * Tells Angular to ignore unknown HTML tags like <app-layer-item>.
       */
      schemas: [NO_ERRORS_SCHEMA, CUSTOM_ELEMENTS_SCHEMA] 
    })
    /**
     * OVERRIDE:
     * By 'setting' a new template and empty imports, bypass the component's 
     * original  'templateUrl' and its dependencies.
     */
    .overrideComponent(MapComponent, {
      set: {
        imports: [CommonModule, FormsModule, DragDropModule], 
        template: `<div #mapContainer></div>`,
        styleUrls: [],
        styles: []
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(MapComponent);
    component = fixture.componentInstance;
    
    /**
     * MANUAL VIEWCHILD INJECTION:
     * In AfterViewInit, the component calls 'initMap(this.mapContainer.nativeElement)'.
     * Provide a fake div so that .nativeElement is never undefined.
     */
    component.mapContainer = new ElementRef(document.createElement('div'));

    fixture.detectChanges();
  });

  /**
   * TEST: Component Initialization
   * Verifies that the component loads and immediately initializes the map.
   */
  it('should create the component', () => {
    expect(component).toBeTruthy();
    expect(mapFacadeMock.initMap).toHaveBeenCalled();
  });

  /**
   * TEST: Modal Triggering
   * Verifies that the 'Add Layer' UI action calls the modal service.
   */
  it('should open Add Layer modal', () => {
    component.onAddLayer();
    expect(modalFactoryMock.open).toHaveBeenCalled();
  });

  /**
   * TEST: Visibility Logic
   * Checks that toggling a layer in the UI calls the underlying Service logic.
   */
  it('should toggle layer visibility', () => {
    const layer = { id: '1', visible: true, planet: 'mars' } as any;
    component.toggleLayer(layer);
    expect(layerManagerMock.toggle).toHaveBeenCalledWith(layer);
  });

  /**
   * TEST: Array Reordering
   * Verifies that the drag-and-drop handler informs the Service of the new order.
   */
  it('should call drag order update on layer drop', () => {
    const layer1 = { id: '1' } as any;
    const layer2 = { id: '2' } as any;
    component.dragOrder = [layer1, layer2];
    
    // Simulate CDK DragDrop event
    component.onLayerDropped({ previousIndex: 0, currentIndex: 1 } as any);
    
    expect(layerManagerMock.reorderLayers).toHaveBeenCalled();
  });

  /**
   * TEST: AI Plugin Modal & Focus
   * This tests an async side-effect. The component waits for a microtask 
   * to focus the textarea. Use 'await Promise.resolve()' to match that timing.
   */
  it('should open AI modal and handle textarea focus', async () => {
    const focusSpy = vi.fn();
    // Manually mock the ViewChild since it's hidden in the real component's ng-template
    component.aiPromptTextarea = { 
      nativeElement: { focus: focusSpy } 
    } as any;

    component.openAiFeatureFindModal();
    expect(component.aiModalRef).toBeDefined();
    
    // Flush the microtask queue to allow the focus() call to happen
    await Promise.resolve();
    expect(focusSpy).toHaveBeenCalled();
  });

  /**
   * TEST: Plugin Layer Creation
   * Verifies that the UI state correctly prepares a layer name for the save dialog.
   */
  it('should open plugin save modal', () => {
    component.openPluginSaveModal();
    expect(component.pluginModalRef).toBeDefined();
    expect(component.pluginLayerName).toBeDefined();
  });

  /**
   * TEST: Transaction Finalization
   * Checks that confirming a save clears the active tool and closes the UI.
   */
  it('should confirm plugin save', () => {
    component.pluginModalRef = {} as any;
    component.confirmSavePlugin('Test Name');
    expect(toolServiceMock.clearTool).toHaveBeenCalled();
    expect(modalFactoryMock.close).toHaveBeenCalled();
  });
});
