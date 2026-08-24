import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/** Same shape I3C DashboardModel.connectionStatus$ emits. */
export interface ConnectionStatus {
  connected: boolean;
  connecting: boolean;
}

/**
 * MIL stand-in for I3C DashboardModel.ConnectToDevice() /
 * connectionStatus$ until the MIL backend is wired.
 */
@Injectable({ providedIn: 'root' })
export class HardwareConnectionService {
  private readonly statusSubject = new BehaviorSubject<ConnectionStatus>({
    connected: false,
    connecting: false
  });

  readonly connectionStatus$ = this.statusSubject.asObservable();

  get snapshot(): ConnectionStatus {
    return this.statusSubject.value;
  }

  async connectToDevice(): Promise<void> {
    if (this.snapshot.connecting) {
      return;
    }

    this.statusSubject.next({
      connected: this.snapshot.connected,
      connecting: true
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    this.statusSubject.next({
      connected: !this.snapshot.connected,
      connecting: false
    });
  }
}
