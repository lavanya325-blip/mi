import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostBinding,
  HostListener,
  Input,
  OnDestroy,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import * as d3 from 'd3';
import { BusPolygon, PacketBus, PlotTrack, Point } from './models/plot-track.model';
import { createSampleTrace, EdgeCollection, TraceData } from './models/trace-data.model';
import { toEngineeringTime, toPoints, toRawPoints } from './extensions/plot-extensions';
import { BusExtensions } from './extensions/bus-extensions';

export type PlotTool =
  | 'snapshot'
  | 'expand'
  | 'select'
  | 'zoomIn'
  | 'zoomOut'
  | 'pan'
  | 'move'
  | 'cursor'
  | 'grid'
  | 'flag';

export interface PlotToolItem {
  id: PlotTool;
  label: string;
  icon: string;
  order: number;
}

@Component({
  selector: 'app-plot-view',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './plot-view.component.html',
  styleUrl: './plot-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlotViewComponent implements AfterViewInit, OnDestroy {
  @ViewChild('waveformContainer') waveformContainer?: ElementRef<HTMLElement>;
  @ViewChild('waveformsvg') waveformsvg?: ElementRef<SVGSVGElement>;

  @Input()
  set capture(value: TraceData | null | undefined) {
    this.loadTrace(value ?? null);
  }

  readonly tracks: PlotTrack[] = [
    { id: 'busA', name: 'Bus A', subtitle: 'MIL 1553', color: '#5B9BD5', kind: 'bus' },
    { id: 'busB', name: 'Bus B', subtitle: 'MIL 1553', color: '#E77352', kind: 'bus' },
    { id: 'ch1', name: 'Channel 1', subtitle: 'Async', color: '#F5C518', kind: 'channel' },
    { id: 'ch2', name: 'Channel 2', subtitle: 'Async', color: '#C084FC', kind: 'channel' },
    { id: 'ch3', name: 'Channel 3', subtitle: 'Async', color: '#F472B6', kind: 'channel' },
    { id: 'ch4', name: 'Channel 4', subtitle: 'Async', color: '#4ADE80', kind: 'channel' }
  ];

  readonly tools: PlotToolItem[] = [
    { id: 'snapshot', label: 'Snapshot', icon: 'photo_camera', order: 0 },
    { id: 'expand', label: 'Full screen', icon: 'open_in_full', order: 1 },
    { id: 'select', label: 'Select', icon: 'mouse', order: 2 },
    { id: 'zoomIn', label: 'Zoom in', icon: 'zoom_in', order: 3 },
    { id: 'zoomOut', label: 'Zoom out', icon: 'zoom_out', order: 4 },
    { id: 'pan', label: 'Pan', icon: 'pan_tool', order: 5 },
    { id: 'move', label: 'Move', icon: 'open_with', order: 6 },
    { id: 'cursor', label: 'Cursor', icon: 'calendar_month', order: 7 },
    { id: 'grid', label: 'Grid', icon: 'grid_on', order: 8 },
    { id: 'flag', label: 'Decode', icon: 'table_chart', order: 9 }
  ];

  hasData = false;
  @HostBinding('class.is-fullscreen') isFullscreen = false;
  activeTool: PlotTool = 'pan';
  gridEnabled = true;
  decodeEnabled = true;
  cursorEnabled = false;
  selectEnabled = false;
  cursorX = -1;
  cursorTimes: number[] = [];
  markerTimes: number[] = [];

  showOverlay = false;
  overlayX = 0;
  overlayWidth = 0;
  private overlayx0 = 0;

  plotWidth = 800;
  plotHeight = 520;
  readonly axisHeight = 24;
  readonly waveHeight = 52;
  readonly decodeHeight = 19;

  xScale!: d3.ScaleLinear<number, number>;
  wavePaths = new Map<string, string>();
  busPolygons = new Map<string, BusPolygon[]>();
  gridLines: { x: number; label: string }[] = [];

  private waveforms = new Map<string, Point[]>();
  private busMap = new Map<string, PacketBus[]>();
  private fullDomain: [number, number] = [0, 1];
  private start = 0;
  private stop = 1;
  private minEdgeWidth = 50e-9;
  private referenceTime = 0;
  private zoomBehavior?: d3.ZoomBehavior<SVGSVGElement, unknown>;
  private resizeObserver?: ResizeObserver;
  private readonly lineGenerator = d3.line<Point>().curve(d3.curveStepAfter);
  private pendingSample = true;

  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    if (this.pendingSample && !this.hasData) {
      this.loadTrace(createSampleTrace());
    }
    this.measurePlot();
    this.resizePlot();
    this.observeSize();
    this.enablePan();
  }

  ngOnDestroy(): void {
    this.clearZoom();
    this.resizeObserver?.disconnect();
  }

  trackTrack(_index: number, track: PlotTrack): string {
    return track.id;
  }

  plotCursor(): string {
    switch (this.activeTool) {
      case 'zoomIn':
      case 'select':
        return 'crosshair';
      case 'zoomOut':
        return 'zoom-out';
      case 'pan':
      case 'move':
        return this.hasData ? 'grab' : 'default';
      case 'cursor':
        return 'col-resize';
      default:
        return 'default';
    }
  }

  toggleFullscreen(): void {
    this.isFullscreen = !this.isFullscreen;
    this.cdr.detectChanges();
    requestAnimationFrame(() => {
      this.measurePlot();
      this.resizePlot();
      this.syncPanTool();
      this.cdr.markForCheck();
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isFullscreen) {
      this.toggleFullscreen();
    }
  }

  @HostListener('document:mouseup', ['$event'])
  onDocumentMouseup(event: MouseEvent): void {
    if (this.showOverlay) {
      this.waveformMouseup(event);
    }
  }

  laneHeight(track: PlotTrack): number {
    return track.kind === 'bus' && this.decodeEnabled
      ? this.waveHeight + this.decodeHeight
      : this.waveHeight;
  }

  laneTop(trackIndex: number): number {
    let top = 0;
    for (let i = 0; i < trackIndex; i++) {
      top += this.laneHeight(this.tracks[i]);
    }
    return top;
  }

  decodeTop(trackIndex: number): number {
    return this.laneTop(trackIndex) + this.waveHeight;
  }

  contentHeight(): number {
    return this.laneTop(this.tracks.length) + this.axisHeight;
  }

  timeX(time: number): number {
    return this.xScale ? this.xScale(time) : 0;
  }

  loadTrace(data: TraceData | null): void {
    this.pendingSample = false;
    this.clearPlot();

    if (!data) {
      this.hasData = false;
      this.cdr.markForCheck();
      return;
    }

    this.minEdgeWidth = data.minEdgeWidth;
    this.referenceTime = data.referenceTime;
    this.fullDomain = [data.startTime, data.endTime];
    this.start = data.startTime;
    this.stop = data.endTime;
    this.applyZoomedWindow();

    Object.entries(data.channels).forEach(([id, collection]) => {
      this.waveforms.set(id, this.edgesToWaveform(collection));
    });
    Object.entries(data.buses).forEach(([id, packets]) => {
      this.busMap.set(id, packets);
    });

    this.hasData = this.waveforms.size > 0;
    this.cdr.detectChanges();
    this.measurePlot();
    this.resizePlot();
    this.syncPanTool();
    this.cdr.markForCheck();
  }

  isToolLit(tool: PlotTool): boolean {
    if (tool === 'grid') {
      return this.gridEnabled;
    }
    if (tool === 'flag') {
      return this.decodeEnabled;
    }
    if (tool === 'cursor') {
      return this.cursorEnabled;
    }
    if (tool === 'select') {
      return this.selectEnabled;
    }
    if (tool === 'expand') {
      return this.isFullscreen;
    }
    return this.activeTool === tool;
  }

  onTool(tool: PlotTool, event: MouseEvent): void {
    event.stopPropagation();

    switch (tool) {
      case 'snapshot':
        this.capturePlot();
        break;
      case 'expand':
        this.toggleFullscreen();
        break;
      case 'zoomIn':
        this.activeTool = 'zoomIn';
        this.clearZoom();
        break;
      case 'zoomOut':
        this.activeTool = 'zoomOut';
        this.clearZoom();
        break;
      case 'pan':
        this.activeTool = 'pan';
        this.enablePan();
        break;
      case 'move':
        this.activeTool = 'move';
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
      case 'grid':
        this.gridEnabled = !this.gridEnabled;
        this.resizePlot();
        break;
      case 'flag':
        this.decodeEnabled = !this.decodeEnabled;
        this.measurePlot();
        this.resizePlot();
        break;
    }

    this.cdr.markForCheck();
  }

  waveformMousedown(event: MouseEvent): void {
    if (!this.hasData || event.button !== 0) {
      return;
    }

    const x = event.offsetX;
    if (this.activeTool === 'zoomIn' || this.selectEnabled) {
      this.showOverlay = true;
      this.overlayx0 = x;
      this.overlayX = x;
      this.overlayWidth = 0;
      event.stopPropagation();
    } else if (this.activeTool === 'zoomOut') {
      this.zoomAround(x, 2);
      event.stopPropagation();
    } else if (this.activeTool === 'cursor' && this.cursorEnabled) {
      this.cursorX = x;
      this.cursorTimes = [...this.cursorTimes, this.xScale.invert(x)];
      event.stopPropagation();
    } else if (this.activeTool === 'select') {
      this.markerTimes = [...this.markerTimes, this.xScale.invert(x)];
      event.stopPropagation();
    }
  }

  waveformMousemove(event: MouseEvent): void {
    if (this.cursorEnabled && !this.showOverlay) {
      this.cursorX = event.offsetX;
      this.cdr.markForCheck();
    }

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
    this.cdr.markForCheck();
  }

  waveformMouseup(event: MouseEvent): void {
    if (!this.showOverlay) {
      return;
    }
    this.showOverlay = false;
    if (this.overlayWidth > 2) {
      const nextStart = this.xScale.invert(this.overlayX);
      const nextStop = this.xScale.invert(this.overlayX + this.overlayWidth);
      if (this.activeTool === 'select' || this.selectEnabled) {
        this.markerTimes = [nextStart, nextStop];
      } else {
        this.start = nextStart;
        this.stop = nextStop;
        this.clampWindow();
        this.resizePlot();
      }
    }
    event.stopPropagation();
    this.cdr.markForCheck();
  }

  waveformWheel(event: WheelEvent): void {
    if (!this.hasData || !this.xScale) {
      return;
    }
    event.preventDefault();
    this.zoomAround(event.offsetX, event.deltaY < 0 ? 0.8 : 1.25);
  }

  waveYScale(trackIndex: number): d3.ScaleLinear<number, number> {
    const top = this.laneTop(trackIndex) + 6;
    const bottom = top + this.waveHeight - 12;
    return d3.scaleLinear().domain([-0.12, 1.12]).range([bottom, top]);
  }

  decodeYScale(trackIndex: number): d3.ScaleLinear<number, number> {
    const top = this.decodeTop(trackIndex) + 1;
    const bottom = top + this.decodeHeight - 2;
    return d3.scaleLinear().domain([-0.1, 1.1]).range([bottom, top]);
  }

  private zoomAround(x: number, factor: number): void {
    const t = this.xScale.invert(x);
    this.start = t - (t - this.start) * factor;
    this.stop = t + (this.stop - t) * factor;
    this.clampWindow();
    this.resizePlot();
  }

  private edgesToWaveform(collection: EdgeCollection): Point[] {
    return toRawPoints(collection.firstEdgeRise, collection.edges);
  }

  private applyZoomedWindow(): void {
    const [begin, end] = this.fullDomain;
    this.start = begin + this.minEdgeWidth * 80;
    this.stop = this.start + this.minEdgeWidth * 140;
    if (this.stop > end) {
      this.start = begin;
      this.stop = Math.min(end, begin + this.minEdgeWidth * 140);
    }
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
      this.stop = Math.min(end, this.start + this.minEdgeWidth * 40);
    }
  }

  private clearPlot(): void {
    this.waveforms.clear();
    this.busMap.clear();
    this.wavePaths.clear();
    this.busPolygons.clear();
    this.cursorTimes = [];
    this.markerTimes = [];
    this.cursorX = -1;
  }

  private clearZoom(): void {
    const svg = this.waveformsvg?.nativeElement;
    if (this.zoomBehavior && svg) {
      d3.select(svg).on('.zoom', null);
      this.zoomBehavior = undefined;
      d3.select(svg).select('g.zoom-content').attr('transform', null);
    }
  }

  private syncPanTool(): void {
    if (this.activeTool === 'pan' || this.activeTool === 'move') {
      this.enablePan();
    }
  }

  private enablePan(): void {
    const svg = this.waveformsvg?.nativeElement;
    if (!svg || !this.hasData) {
      return;
    }
    this.clearZoom();
    this.zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 30])
      .filter(event => {
        if (event.type === 'wheel') {
          return false;
        }
        return !event.button;
      })
      .on('zoom', event => {
        d3.select(svg)
          .select('g.zoom-content')
          .attr('transform', `translate(${event.transform.x},0) scale(${event.transform.k},1)`);
      })
      .on('end', event => {
        const domain = event.transform.rescaleX(this.xScale).domain();
        this.start = domain[0];
        this.stop = domain[1];
        this.clampWindow();
        this.resizePlot();
        d3.select(svg).select('g.zoom-content').attr('transform', null);
        this.zoomBehavior?.transform(d3.select(svg), d3.zoomIdentity);
      });
    d3.select(svg).call(this.zoomBehavior);
  }

  private observeSize(): void {
    const host = this.waveformContainer?.nativeElement;
    if (!host) {
      return;
    }
    this.resizeObserver = new ResizeObserver(() => {
      this.measurePlot();
      this.resizePlot();
    });
    this.resizeObserver.observe(host);
  }

  private measurePlot(): void {
    const rect = this.waveformContainer?.nativeElement.getBoundingClientRect();
    if (!rect) {
      return;
    }
    this.plotWidth = Math.max(240, rect.width);
    this.plotHeight = Math.max(this.contentHeight(), rect.height);
  }

  private resizePlot(): void {
    if (!this.hasData) {
      return;
    }

    const waveWidth = Math.max(1, this.plotWidth);
    this.xScale = d3.scaleLinear().domain([this.start, this.stop]).range([0, waveWidth]);
    const visibleStart = 2 * this.start - this.stop;
    const visibleStop = 2 * this.stop - this.start;

    this.tracks.forEach((track, index) => {
      const yScale = this.waveYScale(index);
      const waveform = this.waveforms.get(track.id) ?? [];
      this.lineGenerator.x(d => this.xScale(d.x)).y(d => yScale(d.y));
      const points = toPoints(waveform, visibleStart, visibleStop, this.fullDomain);
      this.wavePaths.set(track.id, this.lineGenerator(points) ?? '');

      if (track.kind === 'bus') {
        const decodeScale = this.decodeYScale(index);
        const packets = this.busMap.get(track.id) ?? [];
        this.busPolygons.set(
          track.id,
          packets
            .filter(packet => packet.EndTime >= this.start && packet.StartTime <= this.stop)
            .map(packet => ({
              center: BusExtensions.getPolygonCenter(packet, this.xScale, decodeScale),
              path: BusExtensions.getPolygon(packet, this.xScale, decodeScale),
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
          return { x, label: toEngineeringTime(this.xScale.invert(x) - this.referenceTime) };
        })
      : [];

    this.cdr.markForCheck();
  }

  private capturePlot(): void {
    const svg = this.waveformsvg?.nativeElement;
    if (!svg) {
      return;
    }
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
