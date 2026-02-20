import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ToolType = 'none' | 'distance';

@Injectable({ providedIn: 'root' })
export class ToolService {

  private activeToolSubject = new BehaviorSubject<ToolType>('none');
  activeTool$ = this.activeToolSubject.asObservable();

  setActiveTool(tool: ToolType) {
    this.activeToolSubject.next(tool);
  }

  clearTool() {
    this.activeToolSubject.next('none');
  }
}
