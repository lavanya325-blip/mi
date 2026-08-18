import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { PlotCommandService } from '../../../plot-view/plot-command.service';

@Component({
  selector: 'app-tool-bar',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './tool-bar.component.html',
  styleUrl: './tool-bar.component.css'
})
export class ToolBarComponent {
  constructor(private readonly plotCommands: PlotCommandService) {}

  onPlotTool(tool: string): void {
    this.plotCommands.run(tool);
  }
}
