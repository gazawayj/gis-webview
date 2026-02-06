import { TestBed } from '@angular/core/testing';
import { MapService } from './map.service';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { expect, describe, it, beforeEach } from 'vitest';

describe('MapService', () => {
  let service: MapService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(MapService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
