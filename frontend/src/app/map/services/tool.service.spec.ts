/**
 * @file tool.service.spec.ts
 * @description Unit tests for ToolService.
 * Fixed "Test module already instantiated" error.
 */

import '../../../test-setup';
import { TestBed } from '@angular/core/testing';
import { ToolService } from './tool.service';
import { LayerManagerService } from './layer-manager.service';
import { StyleService } from './style.service';
import { HttpClient } from '@angular/common/http';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { firstValueFrom, take } from 'rxjs';
import { CoordinateCapturePlugin } from '../tools/coordinate-capture.plugin';
import { AIAnalysisPlugin } from '../tools/ai-analysis.plugin';

describe('ToolService', () => {
  let service: ToolService;
  let mockLayerManager: any;
  let mockHttpClient: any;
  let mockStyleService: any;

  beforeEach(() => {
    // 1. FIX: Reset TestBed to prevent instantiation errors
    TestBed.resetTestingModule();

    mockLayerManager = { currentPlanet: 'earth' };
    mockHttpClient = { post: vi.fn() };
    mockStyleService = { getLayerStyle: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        ToolService,
        { provide: LayerManagerService, useValue: mockLayerManager },
        { provide: StyleService, useValue: mockStyleService },
        { provide: HttpClient, useValue: mockHttpClient }
      ]
    });

    // 2. Inject service AFTER configuration
    service = TestBed.inject(ToolService);
  });

  it('should have initial active tool as "none"', async () => {
    const tool = await firstValueFrom(service.activeTool$.pipe(take(1)));
    expect(tool).toBe('none');
  });

  it('should update active tool via setActiveTool', async () => {
    service.setActiveTool('distance');
    const tool = await firstValueFrom(service.activeTool$.pipe(take(1)));
    expect(tool).toBe('distance');
  });

  it('should not emit if setting the same active tool twice', () => {
    const nextSpy = vi.spyOn((service as any).activeToolSubject, 'next');
    service.setActiveTool('area');
    service.setActiveTool('area');
    
    // next() is called once for 'area', but the second call returns early
    expect(nextSpy).toHaveBeenCalledTimes(1); 
  });

  describe('Plugin Creation', () => {
    it('should create a CoordinateCapturePlugin instance', () => {
      const plugin = service.createPlugin('coordinate', mockLayerManager);
      expect(plugin).toBeInstanceOf(CoordinateCapturePlugin);
    });

    it('should create an AIAnalysisPlugin instance with HttpClient', () => {
      const plugin = service.createPlugin('ai-analysis', mockLayerManager, mockHttpClient);
      expect(plugin).toBeInstanceOf(AIAnalysisPlugin);
    });

    it('should throw error for AI tool if HttpClient is missing', () => {
      expect(() => {
        service.createPlugin('ai-analysis', mockLayerManager);
      }).toThrow('HttpClient must be provided for AIAnalysisPlugin');
    });
  });

  describe('Registry Filtering', () => {
    it('should separate regular tools from AI tools', () => {
      expect(service.regularTools.length).toBeGreaterThan(0);
      expect(service.aiTools.every(t => t.type.startsWith('ai-'))).toBe(true);
    });
  });
});
