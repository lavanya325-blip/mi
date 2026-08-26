import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-export-section',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './export-section.component.html',
  styleUrl: './export-section.component.css'
})
export class ExportSectionComponent {
  @ViewChild('folderInput') folderInput?: ElementRef<HTMLInputElement>;

  exportLocation = 'D:/file/folder/sss';
  exportFormat = 'CSV';

  formats: string[] = ['CSV', 'TXT', 'JSON', 'XML'];

  browse(): void {
    const input = this.folderInput?.nativeElement;
    if (!input) {
      return;
    }
    input.value = '';
    input.click();
  }

  onFolderSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const withPath = file as File & { path?: string; webkitRelativePath?: string };
    if (withPath.path) {
      const slash = Math.max(withPath.path.lastIndexOf('/'), withPath.path.lastIndexOf('\\'));
      this.exportLocation = slash > 0 ? withPath.path.slice(0, slash) : withPath.path;
      return;
    }

    const relative = withPath.webkitRelativePath || '';
    const folder = relative.split(/[/\\]/)[0];
    this.exportLocation = folder || file.name;
  }
}
