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
  ],

  providers: [],

  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {

  title = 'PGY-I3C-EXPD';

  selectedRole = 'Controller';
  selectedMode = 'Script';
  selectedWindow = 'busConfig';

  showSetupView = 'setupView';
  ctsDeviceValue = 'Target';
  selecteddevicemode = 'EX_PD';
  showDefaultView = 'DEFAULT';

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
  beforeUnloadHandler(event: BeforeUnloadEvent) {
    this.cleanup();
  }

  private cleanup() {
    // Cleanup logic later
  }
}
