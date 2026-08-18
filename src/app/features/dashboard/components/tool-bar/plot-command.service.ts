import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PlotCommandService {
  run(tool: string): void {
    document.dispatchEvent(new CustomEvent('mil-plot-tool', { detail: tool }));
  }
}
