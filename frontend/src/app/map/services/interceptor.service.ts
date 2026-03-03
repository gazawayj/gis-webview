import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable, finalize } from 'rxjs';
import { LoadingService } from './loading.service';

@Injectable()
export class LoadingInterceptor implements HttpInterceptor {
  constructor(private loadingService: LoadingService) {}

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