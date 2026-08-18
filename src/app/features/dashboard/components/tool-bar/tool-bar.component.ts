import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-tool-bar',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './tool-bar.component.html',
  styleUrl: './tool-bar.component.css'
})
export class ToolBarComponent {}
