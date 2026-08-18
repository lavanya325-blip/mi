import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PlotCommandService {
  private readonly commands = new Subject<string>();
  readonly commands$ = this.commands.asObservable();

  run(tool: string): void {
    this.commands.next(tool);
  }
}
