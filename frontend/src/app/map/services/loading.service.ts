import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LoadingService {

  /** Observable to track global loading state */
  private _loading$ = new BehaviorSubject<boolean>(false);
  public readonly loading$ = this._loading$.asObservable();

  private activeRequests = 0;

  /** Start a loading state, incrementing active requests count */
  start() {
    this.activeRequests++;
    this._loading$.next(true);
  }

  /** Stop a loading state, decrementing active requests count */
  stop() {
    this.activeRequests = Math.max(this.activeRequests - 1, 0);
    if (this.activeRequests === 0) this._loading$.next(false);
  }
}