import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Copy this whole file. Do not keep an empty ToolBarComponent class.
 * Plot clicks are sent with a document event — no plot-command.service import.
 */
@Component({
  selector: 'app-tool-bar',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './tool-bar.component.html',
  styleUrl: './tool-bar.component.css'
})
export class ToolBarComponent {
  onPlotTool(tool: string): void {
    document.dispatchEvent(new CustomEvent('mil-plot-tool', { detail: tool }));
  }
}
