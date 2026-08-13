import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface ImportField {
  key: 'labelFile' | 'editLabelFile' | 'database';
  label: string;
  path: string;
  accept: string;
}

@Component({
  selector: 'app-import-section',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './import-section.component.html',
  styleUrl: './import-section.component.css'
})
export class ImportSectionComponent {
  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  activeField: ImportField | null = null;

  fields: ImportField[] = [
    {
      key: 'labelFile',
      label: 'Import Label File',
      path: '',
      accept: '.txt,.csv,.lbl,.xml'
    },
    {
      key: 'editLabelFile',
      label: 'Edit Label File',
      path: '',
      accept: '.txt,.csv,.lbl,.xml'
    },
    {
      key: 'database',
      label: 'Import Database',
      path: '',
      accept: '.db,.sqlite,.json,.xml'
    }
  ];

  browse(field: ImportField): void {
    this.activeField = field;
    const input = this.fileInput?.nativeElement;
    if (!input) {
      return;
    }
    input.accept = field.accept;
    input.value = '';
    input.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.activeField) {
      return;
    }

    this.activeField.path = (file as File & { path?: string }).path || file.name;
    this.activeField = null;
  }
}
