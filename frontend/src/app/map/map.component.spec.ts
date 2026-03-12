/**
 * @file map.component.spec.ts
 * @description Comprehensive unit tests for MapComponent (standalone) - Vitest + Domino friendly.
 */

import '../../test-setup';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ElementRef, Component, Input, Output, EventEmitter } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, Subject } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { HttpClient } from '@angular/common/http';

import { MapComponent } from './map.component';
import { MapFacadeService } from './services/map-facade.service';
import { LayerManagerService } from './services/layer-manager.service';
import { ToolService } from './services/tool.service';
import { ModalFactoryService } from './factories/modal.factory';
import Feature from 'ol/Feature';
import { Polygon } from 'ol/geom';
import Papa from 'papaparse';

@Component({
  selector: 'app-layer-item',
  standalone: true,
  template: '<div></div>'
})
class MockLayerItemComponent {
  @Input() layer: any;
  @Output() colorPicked = new EventEmitter<string>();
  @Output() shapeSelected = new EventEmitter<any>();
}

describe('MapComponent', () => {
  let fixture: ComponentFixture<MapComponent>;
  let component: MapComponent;

  const pointerState$ = new Subject<any>();
  const hoverFeature$ = new Subject<any>();
  const mapSingleClick$ = new Subject<any>();

  let mapFacadeMock: any;
  let layerManagerMock: any;
  let toolServiceMock: any;
  let modalFactoryMock: any;

  beforeEach(async () => {
    TestBed.resetTestingModule();

    mapFacadeMock = {
      getCurrentPlanet: vi.fn(() => 'mars'),
      initMap: vi.fn(),
      registerContextMenuHandler: vi.fn(),
      pointerState$,
      hoverFeature$,
      mapSingleClick$,
      getFeatureAtPixel: vi.fn(() => null),
      getActivePlugin: vi.fn(),
      activateTool: vi.fn(),
      setPlanet: vi.fn(),
      saveByActivePlugin: vi.fn(),
      cancelActivePlugin: vi.fn(),
    };

    layerManagerMock = {
      layers$: of([]),
      loading$: of(false),
      loadingMessage$: of('Loading...'),
      toggle: vi.fn(),
      addManualLayer: vi.fn(() => ({ id: 'l1', name: 'L1', planet: 'mars' })),
      styleService: { setLayerShape: vi.fn() },
      getLayerForFeature: vi.fn(),
      resetFeatureStyle: vi.fn(),
      applyHoverStyle: vi.fn(),
      refreshLayersForPlanet: vi.fn(),
      reorderLayers: vi.fn(),
      updateStyle: vi.fn(),
      resolveLayerName: vi.fn((planet, name) => name),
    };

    toolServiceMock = {
      setActiveTool: vi.fn(),
      clearTool: vi.fn(),
      createPlugin: vi.fn(),
      regularTools: [],
      aiTools: [],
    };

    modalFactoryMock = {
      open: vi.fn(() => ({ backdropClick: () => of(null), close: vi.fn() })),
      close: vi.fn(),
      overlay: { position: () => ({ global: () => ({ left: () => ({ top: () => ({}) }) }) }) },
    };

    (global as any).FileReader = class {
      onload: any = null;
      result: any = null;
      readAsText(this: any, file: any) {
        this.result = file.content || '';
        if (this.onload) this.onload({ target: { result: this.result } });
      }
    };

    (global as any).prompt = vi.fn(() => 'Updated Layer Name');

    await TestBed.configureTestingModule({
      imports: [CommonModule, FormsModule, DragDropModule],
      providers: [
        { provide: MapFacadeService, useValue: mapFacadeMock },
        { provide: LayerManagerService, useValue: layerManagerMock },
        { provide: ToolService, useValue: toolServiceMock },
        { provide: ModalFactoryService, useValue: modalFactoryMock },
        { provide: HttpClient, useValue: { get: vi.fn(), post: vi.fn() } },
      ],
    })
      .overrideComponent(MapComponent, {
        set: {
          imports: [CommonModule, FormsModule, DragDropModule, MockLayerItemComponent],
          template: `
          <div #mapContainer></div>
          <textarea #aiPromptTextarea></textarea>
          <ng-template #addLayerModal></ng-template>
          <ng-template #pluginSaveModal></ng-template>
          <ng-template #aiFeatureFindModal></ng-template>
          <ng-template #layerContextMenu></ng-template>
          <ng-template #importExportModal></ng-template>
          <ng-template #csvSelectionModal></ng-template>
        `,
          styleUrls: []
        }
      })
      .compileComponents();

    fixture = TestBed.createComponent(MapComponent);
    component = fixture.componentInstance;
    component.mapContainer = new ElementRef(document.createElement('div'));
    component.aiPromptTextarea = new ElementRef(document.createElement('textarea'));

    fixture.detectChanges();
  });

  // -----------------------------
  // Initialization & Formatting
  // -----------------------------
  describe('Initialization & Formatting', () => {
    it('should set correct planet labels on init', () => {
      component.currentPlanet = 'mars';
      (component as any).updateLabels();
      expect(component.latLabel).toBe('Areographic Latitude');
    });

    it('should format distance getters for UI displays', () => {
      component.distanceValue = 1500;
      expect(component.formattedDistance).toBe('1.50 km');
    });

    it('should restrict tool availability based on planet context', () => {
      component.currentPlanet = 'moon';
      expect(component.isToolAvailable('highres-selection')).toBe(false);
    });
  });

  // -----------------------------
  // Feature Logic & Attribute Parsing
  // -----------------------------
  describe('Feature Logic & Attribute Parsing', () => {
    it('should format attributes from feature properties', () => {
      const feature = new Feature({ NAME: 'Olympus Mons' });
      const attrs = (component as any).formatFeatureAttributes(feature);
      expect(attrs).toContainEqual(expect.objectContaining({ key: 'Name', value: 'Olympus Mons' }));
    });

    it('should calculate area/perimeter for polygon features', () => {
      const polygon = new Polygon([[[0, 0], [0, 1], [1, 1], [0, 0]]]);
      const feature = new Feature({ geometry: polygon });
      const attrs = (component as any).formatFeatureAttributes(feature);
      expect(attrs).toContainEqual(expect.objectContaining({ key: 'Area' }));
    });
  });

  // -----------------------------
  // File Import & CSV Logic
  // -----------------------------
  describe('File Import & CSV Logic', () => {
    it('should process CSV imports and detect headers', async () => {
      const mockFile = new File(['lat,lon\n0,0'], 'test.csv', { type: 'text/csv' }) as any;
      mockFile.content = 'lat,lon\n0,0';
      const event = { target: { files: [mockFile] } };

      vi.spyOn(Papa, 'parse').mockReturnValue({ meta: { fields: ['lat', 'lon'] } } as any);

      await component.onFileSelected(event); // <-- await if the method returns a promise

      expect(component.importFileType).toBe('CSV');
      expect(modalFactoryMock.open).toHaveBeenCalled();
    });

    it('should confirm CSV selection and add layer through LayerManager', () => {
      component.importFile = { name: 'data.csv', content: 'data' } as any;
      component.importFileType = 'CSV';
      component.confirmCsvSelection();

      expect(layerManagerMock.addManualLayer).toHaveBeenCalled();
    });
  });

  // -----------------------------
  // Plugins & AI Tools
  // -----------------------------
  describe('Plugins & AI Tools', () => {
    it('should execute AI analysis and handle cleanup', async () => {
      const mockPlugin = { execute: vi.fn().mockResolvedValue(null) };
      mapFacadeMock.getActivePlugin.mockReturnValue(mockPlugin);
      component.aiPrompt = 'Scan terrain';

      await component.confirmAiFeatureFind();

      expect(mockPlugin.execute).toHaveBeenCalledWith('Scan terrain');
      expect(toolServiceMock.clearTool).toHaveBeenCalled();
    });

    it('should trigger plugin save with unique timestamped layer names', () => {
      mapFacadeMock.getActivePlugin.mockReturnValue({ name: 'Selection' });
      component.openPluginSaveModal();
      expect(component.pluginLayerName).toMatch(/Selection_\d+/);
    });
  });

  // -----------------------------
  // Sidebar & Context Actions
  // -----------------------------
  describe('Sidebar & Context Actions', () => {
    it('should rename a layer and refresh registry', () => {
      const layer = { name: 'Old', planet: 'mars' } as any;
      component.renameLayer(layer);
      expect(layer.name).toBe('Updated Layer Name');
      expect(layerManagerMock.refreshLayersForPlanet).toHaveBeenCalledWith('mars');
    });

    it('should toggle layer and refresh sidebar checkbox state', () => {
      const layer = { planet: 'earth' } as any;
      component.toggleLayerWithCheckbox(layer);
      expect(layerManagerMock.toggle).toHaveBeenCalledWith(layer);
      expect(layerManagerMock.refreshLayersForPlanet).toHaveBeenCalledWith('earth');
    });
  });
});
