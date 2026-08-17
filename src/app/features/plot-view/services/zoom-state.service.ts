import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { zoomIdentity, ZoomTransform } from 'd3';

@Injectable({ providedIn: 'root' })
export class ZoomStateService {
  private readonly _transform = new BehaviorSubject<ZoomTransform>(zoomIdentity);
  public readonly transform$: Observable<ZoomTransform> = this._transform.asObservable();

  public updateTransform(newTransform: ZoomTransform): void {
    this._transform.next(newTransform);
  }

  public getCurrentTransform(): ZoomTransform {
    return this._transform.getValue();
  }
}
