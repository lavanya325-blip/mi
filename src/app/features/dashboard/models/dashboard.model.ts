import { Injectable, Optional } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { BehaviorSubject } from 'rxjs';
import {
  ConnectionMessageDialogComponent
} from '../components/connection-message-dialog/connection-message-dialog.component';

export interface ConnectionStatus {
  connected: boolean;
  connecting: boolean;
}

export interface MilDeviceInfo {
  Address: string;
}

/**
 * Optional live backend. Provide this token in the real MIL app with CoreService.
 * Same calls I3C DashboardModel uses: getDeviceList / establishLink.
 */
export abstract class MilHardwareBackend {
  abstract getDeviceList(): Promise<MilDeviceInfo[]>;
  abstract establishLink(device: MilDeviceInfo, userName: string): Promise<{ connected: boolean; error?: string }>;
}

/**
 * MIL DashboardModel — same connection contract as I3C:
 * connectionStatus$, ConnectToDevice(), cancelConnectionEstablish().
 * Toolbar must call this, not a local setTimeout toggle.
 */
@Injectable({ providedIn: 'root' })
export class DashboardModel {
  private _connectionStatus = new BehaviorSubject<ConnectionStatus>({
    connected: false,
    connecting: false
  });
  readonly connectionStatus$ = this._connectionStatus.asObservable();

  private username = 'EXPD';
  private ConnectedDevice: MilDeviceInfo | null = null;

  constructor(
    @Optional() private dialog?: MatDialog,
    @Optional() private hardwareBackend?: MilHardwareBackend
  ) {
    this.subscribeDeviceStatus();
  }

  cancelConnectionEstablish(): void {
    if (this._connectionStatus.value.connecting) {
      this._connectionStatus.next({ connected: false, connecting: false });
    }
  }

  async ConnectToDevice(): Promise<void> {
    if (!this.ConnectedDevice) {
      this._connectionStatus.next({ connected: false, connecting: true });

      const devices = await this.getDeviceList();

      if (devices && devices.length > 1) {
        this.openMessage(
          'Connection Manager',
          'More than one device found. Select a device in Connection Manager.',
          'error'
        );
        this._connectionStatus.next({ connected: false, connecting: false });
        return;
      }
    }

    await this.establishLinkForDeviceId(this.ConnectedDevice?.Address ?? null);
  }

  async establishLinkForDeviceId(deviceId: string | null): Promise<void> {
    try {
      this._connectionStatus.next({ connected: false, connecting: true });

      const deviceList = await this.getDeviceList();

      if (!deviceList || deviceList.length === 0) {
        throw new Error('No device found, check the connection and try again.');
      }

      let selectedDevice = deviceList[0];
      if (deviceId) {
        const match = deviceList.find(device => device.Address === deviceId);
        if (!match) {
          throw new Error('Selected device not found. Please refresh and try again.');
        }
        selectedDevice = match;
      }

      let success = false;

      if (this.hardwareBackend) {
        const response = await this.hardwareBackend.establishLink(selectedDevice, this.username);
        success = response.connected;
        if (!success) {
          throw new Error(response.error || 'Could not connect to device. Check connection and retry');
        }
      } else {
        throw new Error('No device found, check the connection and try again.');
      }

      if (success) {
        this.ConnectedDevice = selectedDevice;
        this._connectionStatus.next({ connected: true, connecting: false });
        this.openMessage(
          'Connected',
          'USB Connection Established Successfully',
          'success'
        );
      }
    } catch (error: unknown) {
      const message = error instanceof Error
        ? error.message
        : 'Could not connect to device. Check connection and retry.';

      this.openMessage('Device disconnected', message, 'error');
      this.ConnectedDevice = null;
      this._connectionStatus.next({ connected: false, connecting: false });
    }
  }

  async getDeviceList(): Promise<MilDeviceInfo[]> {
    if (this.hardwareBackend) {
      return this.hardwareBackend.getDeviceList();
    }
    return [];
  }

  private subscribeDeviceStatus(): void {
    const pubsub = (globalThis as { PubSub?: { subscribe: Function } }).PubSub;
    if (!pubsub?.subscribe) {
      return;
    }

    pubsub.subscribe('DeviceStatusResponse', (_type: string, msg: { Error?: unknown; IsLinkEstablished?: boolean }) => {
      if (!msg) {
        return;
      }
      if (msg.Error) {
        this.openMessage(
          'Device disconnected',
          'Device got disconnected, check connection.',
          'error'
        );
      }
      this.ConnectedDevice = null;
      this._connectionStatus.next({
        connected: !!msg.IsLinkEstablished,
        connecting: false
      });
    });
  }

  private openMessage(title: string, message: string, icon: 'success' | 'error'): void {
    if (this.dialog) {
      this.dialog.open(ConnectionMessageDialogComponent, {
        data: { title, message, icon },
        backdropClass: 'custom-dialog-backdrop'
      });
      return;
    }
    console.log(`[${icon}] ${title}: ${message}`);
  }
}
