import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface ConnectionMessageData {
  title: string;
  message: string;
  icon: 'success' | 'error';
}

@Component({
  selector: 'app-connection-message-dialog',
  standalone: true,
  template: `
    <section class="connection-dialog">
      <h2>{{ data.title }}</h2>
      <p>{{ data.message }}</p>
      <button type="button" (click)="dialogRef.close()">Close</button>
    </section>
  `,
  styles: [`
    .connection-dialog {
      min-width: 280px;
      padding: 16px;
      font-family: Roboto, sans-serif;
    }
    h2 { margin: 0 0 8px; font-size: 16px; }
    p { margin: 0 0 16px; font-size: 13px; }
    button {
      border: 1px solid #71717A;
      background: #27272A;
      color: #D4D4D8;
      height: 28px;
      padding: 0 12px;
      cursor: pointer;
    }
  `]
})
export class ConnectionMessageDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ConnectionMessageDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConnectionMessageData
  ) {}
}
