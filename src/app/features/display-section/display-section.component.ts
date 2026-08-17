import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-display-section',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './display-section.component.html',
  styleUrl: './display-section.component.css'
})
export class DisplaySectionComponent {
  selectedView = 'Listing Window';

  views: string[] = [
    'Timing Plot & Listing Window',
    'Listing Window',
    'Timing'
  ];
}
