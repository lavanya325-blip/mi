import { Component, HostListener } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { HttpClientModule } from '@angular/common/http';
import { ScrollingModule } from '@angular/cdk/scrolling';

import { MenuBarComponent } from './features/dashboard/components/menu-bar/menu-bar.component';
import { ToolBarComponent } from './features/dashboard/components/tool-bar/tool-bar.component';
import { ChannelSelectionComponent } from './features/channel-selection/channel-selection.component';
import { PlotViewComponent } from './features/plot-view/plot-view.component';
import { ImportSectionComponent } from './features/import-section/import-section.component';
import { DisplaySectionComponent } from './features/display-section/display-section.component';

@Component({
  selector: 'app-root',
  standalone: true,

  imports: [
    HttpClientModule,
    CommonModule,
    MatTableModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    RouterOutlet,
    ScrollingModule,
    MenuBarComponent,
    ToolBarComponent,
    ChannelSelectionComponent,
    PlotViewComponent,
    ImportSectionComponent,
    DisplaySectionComponent,
  ],

  providers: [],

  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {

  title = 'PGY-I3C-EXPD';

  isDarkMode = true;
  isHardwareConnected = false;

  selectedRole = 'Controller';
  selectedMode = 'Script';
  selectedWindow = 'busConfig';

  showSetupView = 'setupView';
  ctsDeviceValue = 'Target';
  selecteddevicemode = 'EX_PD';
  showDefaultView = 'DEFAULT';

  constructor() {
    this.applyTheme(this.isDarkMode);
  }

  toggleDarkMode(): void {
    this.isDarkMode = !this.isDarkMode;
    this.applyTheme(this.isDarkMode);
  }

  onHardwareConnection(connected: boolean): void {
    this.isHardwareConnected = connected;
    console.log(connected ? 'Hardware connected' : 'Hardware disconnected');
  }

  onSelectionChange(selection: {
    role: string;
    mode: string;
    activeView: string;
    showSetupView: string;
    ctsDeviceValue: string;
    selectedMode: string;
  }) {
    this.selectedRole = selection.role;
    this.selectedMode = selection.mode;
    this.selectedWindow = selection.activeView;
    this.showSetupView = selection.showSetupView;
    this.ctsDeviceValue = selection.ctsDeviceValue;
    this.selecteddevicemode = selection.selectedMode;
  }

  OnSelectionDefaultChange(selection: {
    showDefaultView: string
  }) {
    this.showDefaultView = selection?.showDefaultView;
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnloadHandler(_event: BeforeUnloadEvent) {
    this.cleanup();
  }

  private applyTheme(dark: boolean): void {
    const html = document.documentElement;
    const body = document.body;
    const appRoot = document.querySelector('app-root');
    const classes = ['dark-mode', 'light-mode', 'dark-theme', 'light-theme'];

    html.classList.remove(...classes);
    body.classList.remove(...classes);
    appRoot?.classList.remove(...classes);

    const theme = dark ? 'dark-mode' : 'light-mode';
    html.classList.add(theme);
    body.classList.add(theme);
    appRoot?.classList.add(theme);
  }

  private cleanup() {
    // Cleanup logic later
  }
}
