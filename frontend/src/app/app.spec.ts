import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app';
import { vi, beforeAll, beforeEach, describe, it, expect } from 'vitest';

describe('App', () => {
  beforeAll(() => {
    // Use a proper class to satisfy the 'new' constructor requirement
    vi.stubGlobal('ResizeObserver', class {
      observe() { }
      unobserve() { }
      disconnect() { }
    });
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges(); // <--- Essential to render the HTML
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('GIS WebView');
  });
});
