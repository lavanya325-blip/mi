import { Component, HostListener, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-display-section',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './display-section.component.html',
  styleUrls: ['./display-section.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class DisplaySectionComponent {
  selectedView = 'Listing Window';
  menuOpen = false;

  views: string[] = [
    'Timing Plot & Listing Window',
    'Listing Window',
    'Timing'
  ];

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  selectView(view: string): void {
    this.selectedView = view;
    this.menuOpen = false;
  }

  @HostListener('document:click')
  closeMenu(): void {
    this.menuOpen = false;
  }
}
