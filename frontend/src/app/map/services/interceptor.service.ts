import { Injectable, inject } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable, finalize } from 'rxjs';
import { LoadingService } from './loading.service';

@Injectable()
export class LoadingInterceptor implements HttpInterceptor {
  // Use inject() instead of constructor injection
  private loadingService = inject(LoadingService);

  /**
   * Intercepts HTTP requests to show/hide a loading spinner.
   * Skips tile requests (.png) to avoid excessive spinners.
   * @param req Outgoing HTTP request
   * @param next Handler for the request
   * @returns Observable of HTTP events
   */
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Only show for layer/data calls, not tiles (optionally filter URLs)
    const showSpinner = !req.url.includes('tiles') && !req.url.endsWith('.png');

    if (showSpinner) this.loadingService.start();

    return next.handle(req).pipe(
      finalize(() => {
        if (showSpinner) this.loadingService.stop();
      })
    );
  }
}