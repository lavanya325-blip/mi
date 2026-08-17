import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as d3 from 'd3';
import { BusPolygon, PacketBus, PlotTool, PlotTrack, Point } from './models/plot-track.model';
import { createSampleTrace, EdgeCollection, TraceData } from './models/trace-data.model';
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
  @ViewChild('waveformContainer') waveformContainer?: ElementRef<HTMLElement>;
  @ViewChild('waveformsvg') waveformsvg?: ElementRef<SVGSVGElement>;

  /** Later: bind imported trace. Until then sample data is used. */
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

  readonly tools: { id: PlotTool; label: string }[] = [
    { id: 'snapshot', label: 'Snapshot' },
    { id: 'fit', label: 'Zoom to fit (unzoomed)' },
    { id: 'zoomIn', label: 'Zoom in' },
    { id: 'zoomOut', label: 'Zoom out' },
    { id: 'pan', label: 'Pan' },
    { id: 'select', label: 'Select' },
    { id: 'cursor', label: 'Cursor' },
    { id: 'marker', label: 'Marker' },
    { id: 'grid', label: 'Grid' },
    { id: 'flag', label: 'Flag' }
  ];

  hasData = false;
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
  readonly axisHeight = 24;

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
    this.enablePan();
    this.observeSize();
  }

  ngOnDestroy(): void {
    this.clearZoom();
    this.resizeObserver?.disconnect();
  }

  trackTrack(_index: number, track: PlotTrack): string {
    return track.id;
  }

  /**
   * Single entry for plot data. Map a loaded .trace / ResultService
   * response into TraceData and call this.
   */
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
    this.applyZoomedWindow();

    Object.entries(data.channels).forEach(([id, collection]) => {
      this.waveforms.set(id, this.edgesToWaveform(collection));
    });
    Object.entries(data.buses).forEach(([id, packets]) => {
      this.busMap.set(id, packets);
    });

    this.hasData = this.waveforms.size > 0;
    this.measurePlot();
    this.resizePlot();
    this.cdr.markForCheck();
  }

  onTool(tool: PlotTool, event: MouseEvent): void {
    event.stopPropagation();
    if (!this.hasData && tool !== 'snapshot') {
      return;
    }

    switch (tool) {
      case 'snapshot':
        this.capturePlot();
        break;
      case 'fit':
        this.start = this.fullDomain[0];
        this.stop = this.fullDomain[1];
        this.activeTool = 'fit';
        this.resizePlot();
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
    if (!this.hasData || event.button !== 0) {
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
      const range = this.stop - this.start;
      const t = this.xScale.invert(x);
      this.start = t - range * 2;
      this.stop = t + range * 2;
      this.clampWindow();
      this.resizePlot();
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

  waveYScale(trackIndex: number): d3.ScaleLinear<number, number> {
    const top = trackIndex * this.laneHeight + 6;
    const bottom = top + this.waveBandHeight(this.tracks[trackIndex]);
    return d3.scaleLinear().domain([-0.12, 1.12]).range([bottom, top]);
  }

  decodeYScale(trackIndex: number): d3.ScaleLinear<number, number> {
    const top = trackIndex * this.laneHeight + this.waveBandHeight(this.tracks[trackIndex]) + 4;
    const bottom = (trackIndex + 1) * this.laneHeight - 6;
    return d3.scaleLinear().domain([-0.1, 1.1]).range([bottom, top]);
  }

  private waveBandHeight(track: PlotTrack): number {
    return track.kind === 'bus' ? this.laneHeight * 0.55 : this.laneHeight - 12;
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
    this.markers = [];
    this.flags = [];
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

  private enablePan(): void {
    const svg = this.waveformsvg?.nativeElement;
    if (!svg || !this.hasData) {
      return;
    }
    this.clearZoom();
    this.zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 30])
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
    this.plotHeight = Math.max(240, rect.height);
    this.laneHeight = (this.plotHeight - this.axisHeight) / this.tracks.length;
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
