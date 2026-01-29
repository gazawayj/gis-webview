import { TestBed, ComponentFixture } from '@angular/core/testing';
import { AppComponent } from './app';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let component: AppComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      // Ensure HttpClientTestingModule is here if your app calls the backend
      imports: [AppComponent, HttpClientTestingModule],
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
  });

  it('should create the app', () => {
    expect(component).toBeTruthy();
  });

  it('should render title', () => {
    // 1. Manually trigger change detection so the template renders
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    
    // 2. Adjust the selector to match HTML. 
    const titleElement = compiled.querySelector('h1') || compiled.querySelector('.title');
    
    expect(titleElement).toBeTruthy();
    // 3. Match the actual text content 
    expect(titleElement?.textContent).toContain('GIS Webview');
  });
});
