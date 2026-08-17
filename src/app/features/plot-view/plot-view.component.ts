import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as d3 from 'd3';
import { BusPolygon, PacketBus, PlotTool, PlotTrack, Point } from './models/plot-track.model';
import { toEngineeringTime, toPoints, toRawPoints } from './extensions/plot-extensions';
import { BusExtensions } from './extensions/bus-extensions';

@Component({
  selector: 'app-plot-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './plot-view.component.html',
  styleUrl: './plot-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlotViewComponent implements AfterViewInit, OnDestroy {
  @ViewChild('waveformContainer', { static: true }) waveformContainer!: ElementRef<HTMLElement>;
  @ViewChild('waveformsvg', { static: true }) waveformsvg!: ElementRef<SVGSVGElement>;

  readonly tracks: PlotTrack[] = [
    { id: 'busA', name: 'Bus A', subtitle: 'MIL 1553', color: '#5B9BD5', kind: 'bus' },
    { id: 'busB', name: 'Bus B', subtitle: 'MIL 1553', color: '#E77352', kind: 'bus' },
    { id: 'ch1', name: 'Channel 1', subtitle: 'Async', color: '#F5C518', kind: 'channel' },
    { id: 'ch2', name: 'Channel 2', subtitle: 'Async', color: '#C084FC', kind: 'channel' },
    { id: 'ch3', name: 'Channel 3', subtitle: 'Async', color: '#F472B6', kind: 'channel' },
    { id: 'ch4', name: 'Channel 4', subtitle: 'Async', color: '#4ADE80', kind: 'channel' }
  ];

  readonly tools: { id: PlotTool; label: string }[] = [
    { id: 'snapshot', label: 'Snapshot' },
    { id: 'fit', label: 'Zoom to fit' },
    { id: 'zoomIn', label: 'Zoom in' },
    { id: 'zoomOut', label: 'Zoom out' },
    { id: 'pan', label: 'Pan' },
    { id: 'select', label: 'Select' },
    { id: 'cursor', label: 'Cursor' },
    { id: 'marker', label: 'Marker' },
    { id: 'grid', label: 'Grid' },
    { id: 'flag', label: 'Flag' }
  ];

  activeTool: PlotTool = 'pan';
  gridEnabled = true;
  cursorEnabled = false;
  selectEnabled = false;
  markerEnabled = false;
  flagEnabled = false;
  cursorX = -1;
  markers: number[] = [];
  flags: number[] = [];

  showOverlay = false;
  overlayX = 0;
  overlayWidth = 0;
  private overlayx0 = 0;

  plotWidth = 800;
  plotHeight = 520;
  laneHeight = 80;
  readonly axisHeight = 22;

  xScale!: d3.ScaleLinear<number, number>;
  channelPaths = new Map<string, string>();
  busWavePaths = new Map<string, string>();
  busPolygons = new Map<string, BusPolygon[]>();
  gridLines: { x: number; label: string }[] = [];

  private waveforms = new Map<string, Point[]>();
  private busMap = new Map<string, PacketBus[]>();
  private fullDomain: [number, number] = [0, 2e-6];
  private start = 0;
  private stop = 2e-7;
  private minEdgeWidth = 40e-9;
  private zoomBehavior?: d3.ZoomBehavior<SVGSVGElement, unknown>;
  private resizeObserver?: ResizeObserver;
  private readonly lineGenerator = d3.line<Point>().curve(d3.curveStepAfter);

  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.buildDemoCapture();
    this.measurePlot();
    this.resizePlot();
    this.enablePan();

    this.resizeObserver = new ResizeObserver(() => {
      this.measurePlot();
      this.resizePlot();
    });
    this.resizeObserver.observe(this.waveformContainer.nativeElement);
  }

  ngOnDestroy(): void {
    this.clearZoom();
    this.resizeObserver?.disconnect();
  }

  trackTrack(_index: number, track: PlotTrack): string {
    return track.id;
  }

  onTool(tool: PlotTool, event: MouseEvent): void {
    event.stopPropagation();

    switch (tool) {
      case 'snapshot':
        this.capturePlot();
        break;
      case 'fit':
        this.fitView();
        this.activeTool = 'fit';
        break;
      case 'zoomIn':
        this.clearZoom();
        this.activeTool = 'zoomIn';
        break;
      case 'zoomOut':
        this.clearZoom();
        this.activeTool = 'zoomOut';
        break;
      case 'pan':
        this.activeTool = 'pan';
        this.enablePan();
        break;
      case 'select':
        this.selectEnabled = !this.selectEnabled;
        this.activeTool = 'select';
        this.clearZoom();
        break;
      case 'cursor':
        this.cursorEnabled = !this.cursorEnabled;
        this.activeTool = 'cursor';
        this.clearZoom();
        if (!this.cursorEnabled) {
          this.cursorX = -1;
        }
        break;
      case 'marker':
        this.markerEnabled = !this.markerEnabled;
        this.activeTool = 'marker';
        this.clearZoom();
        break;
      case 'grid':
        this.gridEnabled = !this.gridEnabled;
        this.resizePlot();
        break;
      case 'flag':
        this.flagEnabled = !this.flagEnabled;
        this.activeTool = 'flag';
        this.clearZoom();
        break;
    }

    this.cdr.markForCheck();
  }

  waveformMousedown(event: MouseEvent): void {
    if (event.button !== 0) {
      return;
    }

    const x = event.offsetX;
    if (this.activeTool === 'zoomIn') {
      this.showOverlay = true;
      this.overlayx0 = x;
      this.overlayX = x;
      this.overlayWidth = 0;
      event.stopPropagation();
    } else if (this.activeTool === 'zoomOut') {
      this.zoomAround(x, 4);
      event.stopPropagation();
    } else if (this.activeTool === 'cursor' && this.cursorEnabled) {
      this.cursorX = x;
      event.stopPropagation();
    } else if (this.activeTool === 'marker' && this.markerEnabled) {
      this.markers = [...this.markers, x];
      event.stopPropagation();
    } else if (this.activeTool === 'flag' && this.flagEnabled) {
      this.flags = [...this.flags, x];
      event.stopPropagation();
    } else if (this.activeTool === 'select' && this.selectEnabled) {
      this.cursorX = x;
      event.stopPropagation();
    }
  }

  waveformMousemove(event: MouseEvent): void {
    if (!this.showOverlay) {
      return;
    }
    if (event.offsetX >= this.overlayx0) {
      this.overlayX = this.overlayx0;
      this.overlayWidth = event.offsetX - this.overlayx0;
    } else {
      this.overlayX = event.offsetX;
      this.overlayWidth = this.overlayx0 - event.offsetX;
    }
    event.stopPropagation();
  }

  waveformMouseup(event: MouseEvent): void {
    if (!this.showOverlay) {
      return;
    }
    this.showOverlay = false;
    if (this.overlayWidth > 2) {
      this.start = this.xScale.invert(this.overlayX);
      this.stop = this.xScale.invert(this.overlayX + this.overlayWidth);
      this.clampWindow();
      this.resizePlot();
    }
    event.stopPropagation();
  }

  private zoomAround(pixelX: number, factor: number): void {
    const visibleRange = this.stop - this.start;
    const position = this.xScale.invert(pixelX);
    this.start = position - (visibleRange * factor) / 2;
    this.stop = position + (visibleRange * factor) / 2;
    this.clampWindow();
    this.resizePlot();
  }

  private fitView(): void {
    this.start = this.fullDomain[0];
    this.stop = this.fullDomain[1];
    this.resizePlot();
  }

  private clampWindow(): void {
    const [begin, end] = this.fullDomain;
    if (this.start < begin) {
      this.start = begin;
    }
    if (this.stop > end) {
      this.stop = end;
    }
    if (this.stop <= this.start) {
      this.stop = Math.min(end, this.start + this.minEdgeWidth * 80);
    }
  }

  private clearZoom(): void {
    if (this.zoomBehavior) {
      d3.select(this.waveformsvg.nativeElement).on('.zoom', null);
      this.zoomBehavior = undefined;
    }
    d3.select(this.waveformsvg.nativeElement).select('g.zoom-content').attr('transform', null);
  }

  private enablePan(): void {
    this.clearZoom();
    this.zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 20])
      .on('zoom', event => {
        d3.select(this.waveformsvg.nativeElement)
          .select('g.zoom-content')
          .attr('transform', `translate(${event.transform.x},0) scale(${event.transform.k},1)`);
      })
      .on('end', event => {
        const domain = event.transform.rescaleX(this.xScale).domain();
        this.start = domain[0];
        this.stop = domain[1];
        this.clampWindow();
        this.resizePlot();
        d3.select(this.waveformsvg.nativeElement).select('g.zoom-content').attr('transform', null);
        this.zoomBehavior?.transform(d3.select(this.waveformsvg.nativeElement), d3.zoomIdentity);
      });

    d3.select(this.waveformsvg.nativeElement).call(this.zoomBehavior);
  }

  private measurePlot(): void {
    const rect = this.waveformContainer.nativeElement.getBoundingClientRect();
    this.plotWidth = Math.max(240, rect.width);
    this.plotHeight = Math.max(240, rect.height);
    this.laneHeight = (this.plotHeight - this.axisHeight) / this.tracks.length;
  }

  private resizePlot(): void {
    const waveWidth = Math.max(1, this.plotWidth);
    this.xScale = d3.scaleLinear().domain([this.start, this.stop]).range([0, waveWidth]);

    const visibleStart = 2 * this.start - this.stop;
    const visibleStop = 2 * this.stop - this.start;

    this.tracks.forEach((track, index) => {
      const yScale = d3
        .scaleLinear()
        .domain([-0.15, 1.15])
        .range([(index + 1) * this.laneHeight - 10, index * this.laneHeight + 10]);

      const waveform = this.waveforms.get(track.id) ?? [];
      this.lineGenerator.x(d => this.xScale(d.x)).y(d => yScale(d.y));
      const points = toPoints(waveform, visibleStart, visibleStop, this.fullDomain);
      const path = this.lineGenerator(points) ?? '';

      if (track.kind === 'channel') {
        this.channelPaths.set(track.id, path);
      } else {
        this.busWavePaths.set(track.id, path);
        const buses = this.busMap.get(track.id) ?? [];
        this.busPolygons.set(
          track.id,
          buses
            .filter(packet => packet.EndTime >= this.start && packet.StartTime <= this.stop)
            .map(packet => ({
              center: BusExtensions.getPolygonCenter(packet, this.xScale, yScale),
              path: BusExtensions.getPolygon(packet, this.xScale, yScale),
              content: packet.Content,
              startTime: packet.StartTime,
              endTime: packet.EndTime
            }))
        );
      }
    });

    const lineCount = 9;
    this.gridLines = this.gridEnabled
      ? Array.from({ length: lineCount }, (_, i) => {
          const x = ((i + 1) * waveWidth) / (lineCount + 1);
          return { x, label: toEngineeringTime(this.xScale.invert(x) - this.fullDomain[0]) };
        })
      : [];

    this.cdr.markForCheck();
  }

  /** I3C-style edges -> 0/1 points. Zoomed vs unzoomed is only xScale domain. */
  private buildDemoCapture(): void {
    this.minEdgeWidth = 40e-9;
    const start = 0;
    const stop = 8e-6;
    this.fullDomain = [start, stop];
    this.start = start + 1.2e-6;
    this.stop = start + 1.85e-6;

    this.tracks.forEach(track => {
      const edges: number[] = [];
      let t = start;
      const period = track.kind === 'channel' ? this.minEdgeWidth * 2.2 : this.minEdgeWidth * 8;
      while (t < stop) {
        t += period;
        edges.push(t);
      }
      this.waveforms.set(track.id, toRawPoints(true, edges));
    });

    const busLabelsA = ['17', 'D', 'S', '000000000001'];
    const busLabelsB = ['2A', 'D', 'S', '000000001010'];
    this.busMap.set('busA', this.buildPackets(start, stop, busLabelsA, 0));
    this.busMap.set('busB', this.buildPackets(start, stop, busLabelsB, this.minEdgeWidth * 3));
  }

  private buildPackets(start: number, stop: number, labels: string[], offset: number): PacketBus[] {
    const packets: PacketBus[] = [];
    let t = start + offset;
    let i = 0;
    while (t < stop) {
      const width = this.minEdgeWidth * (10 + (i % 3) * 6);
      packets.push({ StartTime: t, EndTime: t + width, Content: labels[i % labels.length] });
      t += width + this.minEdgeWidth * 4;
      i++;
    }
    return packets;
  }

  private capturePlot(): void {
    const svg = this.waveformsvg.nativeElement;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], {
      type: 'image/svg+xml;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'plot-view.svg';
    link.click();
    URL.revokeObjectURL(url);
  }
}
