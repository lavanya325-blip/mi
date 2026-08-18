import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface PacketGridRow {
  id: number;
  busA: string;
  busB: string;
  command: string;
  dataWord: string;
  status: string;
}

@Component({
  selector: 'app-packet-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './packet-grid.component.html',
  styleUrl: './packet-grid.component.css'
})
export class PacketGridComponent {
  readonly columns = [
    { key: 'busA', label: 'BUS A' },
    { key: 'busB', label: 'BUS B' },
    { key: 'command', label: 'Command' },
    { key: 'dataWord', label: 'Data Word' },
    { key: 'status', label: 'Status (RT to BC)' }
  ] as const;

  rows: PacketGridRow[] = [
    { id: 1, busA: 'BC → RT 2', busB: '', command: 'RCV 0x02', dataWord: '0x001A', status: '' },
    { id: 2, busA: '', busB: 'RT 2 → BC', command: '', dataWord: '', status: '0x0800' },
    { id: 3, busA: 'BC → RT 5', busB: '', command: 'XMT 0x05', dataWord: '0x00B3', status: '' },
    { id: 4, busA: '', busB: 'RT 5 → BC', command: '', dataWord: '0x4F21', status: '0x0800' },
    { id: 5, busA: 'BC → RT 1', busB: '', command: 'RCV 0x01', dataWord: '0x0007', status: '' },
    { id: 6, busA: '', busB: 'RT 1 → BC', command: '', dataWord: '', status: '0x0000' }
  ];

  trackRow(_index: number, row: PacketGridRow): number {
    return row.id;
  }
}
