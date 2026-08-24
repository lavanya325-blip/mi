import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';
import { HardwareConnectionService } from '../../services/hardware-connection.service';

@Component({
  selector: 'app-tool-bar',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatTooltipModule
  ],
  templateUrl: './tool-bar.component.html',
  styleUrl: './tool-bar.component.css'
})
export class ToolBarComponent implements OnInit, OnDestroy {

  @Input()
  isDarkMode = false;

  @Output()
  darkModeToggle = new EventEmitter<void>();

  @Output()
  connectionChange = new EventEmitter<boolean>();

  @Output()
  selectionChange = new EventEmitter<{
    role: string;
    mode: string;
    activeView: string;
    showSetupView: string;
    ctsDeviceValue: string;
    selectedMode: string;
  }>();

  isRunning = false;
  currentZoom = 100;

  IsLoadingConnection = false;
  connectDisabled = false;
  isconnected = false;

  private wasConnected = false;
  private statusSub?: Subscription;

  constructor(private hardwareConnection: HardwareConnectionService) {}

  ngOnInit(): void {
    this.statusSub = this.hardwareConnection.connectionStatus$.subscribe(status => {
      const previouslyConnected = this.wasConnected;
      this.isconnected = status.connected;
      this.IsLoadingConnection = status.connecting;

      if (!status.connecting) {
        this.connectionChange.emit(this.isconnected);
      }

      // I3C: disconnect keeps the current mode
      if (!this.isconnected) {
        this.wasConnected = false;
        return;
      }

      // I3C: reconnect (false → true) returns to EX_PD setup
      if (!previouslyConnected && this.isconnected) {
        this.emitConnectedSelection();
      }

      this.wasConnected = this.isconnected;
    });
  }

  ngOnDestroy(): void {
    this.statusSub?.unsubscribe();
  }

  async connect(): Promise<void> {
    if (this.IsLoadingConnection || this.connectDisabled) {
      return;
    }

    this.connectDisabled = true;
    try {
      await this.hardwareConnection.connectToDevice();
    } finally {
      this.connectDisabled = false;
    }
  }

  toggleDarkMode(): void {
    this.darkModeToggle.emit();
  }

  onTrigger(): void {
    console.log('Trigger clicked');
  }

  onMenuItem(menuItem: string): void {
    console.log(`${menuItem} clicked`);
  }

  onRun(): void {
    this.isRunning = !this.isRunning;
    console.log(this.isRunning ? 'Acquisition started' : 'Acquisition stopped');
  }

  onUpload(): void {
    console.log('Upload clicked');
  }

  onSettings(): void {
    console.log('Settings clicked');
  }

  onSearch(): void {
    console.log('Search clicked');
  }

  onPrevious(): void {
    console.log('Previous clicked');
  }

  onNext(): void {
    console.log('Next clicked');
  }

  onWebhook(): void {
    console.log('Webhook clicked');
  }

  private emitConnectedSelection(): void {
    this.selectionChange.emit({
      role: '',
      mode: 'Script',
      activeView: 'busConfig',
      showSetupView: 'setupView',
      ctsDeviceValue: 'Target',
      selectedMode: 'EX_PD'
    });
  }
}
