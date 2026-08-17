import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as d3 from 'd3';
import { PacketBus, Point } from './models/plot.model';
import { toPoints, toRawPoints } from './extensions/plot-extensions';
import { BusExtensions } from './extensions/bus-extensions';
import { ZoomStateService } from './services/zoom-state.service';
import { D3ZoomHandler, D3ZoomHandlerCallbacks } from './services/zoom-handler';

export interface PlotLane {
  id: string;
  name: string;
  subtitle: string;
  color: string;
  kind: 'bus' | 'channel';
}

export interface BusPolygon {
  center: Point;
  path: string;
  content: string;
  startTime: number;
  endTime: number;
}

export type PlotTool =
  | 'snapshot'
  | 'fit'
  | 'zoomIn'
  | 'zoomOut'
  | 'pan'
  | 'grid'
  | 'cursor'
  | 'hZoom'
  | 'bits'
  | 'more';

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

  readonly lanes: PlotLane[] = [
    { id: 'busA', name: 'Bus A', subtitle: 'MIL 1553', color: '#2F80ED', kind: 'bus' },
    { id: 'busB', name: 'Bus B', subtitle: 'MIL 1553', color: '#E77352', kind: 'bus' },
    { id: 'ch1', name: 'Channel 1', subtitle: 'Async', color: '#F5C518', kind: 'channel' },
    { id: 'ch2', name: 'Channel 2', subtitle: 'Async', color: '#A78BFA', kind: 'channel' },
    { id: 'ch3', name: 'Channel 3', subtitle: 'Async', color: '#F472B6', kind: 'channel' },
    { id: 'ch4', name: 'Channel 4', subtitle: 'Async', color: '#4ADE80', kind: 'channel' }
  ];

  readonly tools: { id: PlotTool; label: string }[] = [
    { id: 'snapshot', label: 'Snapshot' },
    { id: 'fit', label: 'Fit to view' },
    { id: 'zoomIn', label: 'Zoom in' },
    { id: 'zoomOut', label: 'Zoom out' },
    { id: 'pan', label: 'Pan' },
    { id: 'grid', label: 'Grid' },
    { id: 'cursor', label: 'Cursor' },
    { id: 'hZoom', label: 'Horizontal zoom' },
    { id: 'bits', label: 'Bits / point' },
    { id: 'more', label: 'More' }
  ];

  activeTool: PlotTool = 'pan';
  gridEnabled = true;
  showBits = false;
  showMore = false;
  cursorEnabled = false;
  cursorX = -1;

  showOverlay = false;
  overlayX = 0;
  overlayWidth = 0;
  private overlayx0 = 0;

  plotWidth = 800;
  plotHeight = 480;
  laneHeight = 70;
  readonly labelWidth = 118;

  xScale!: d3.ScaleLinear<number, number>;
  channelPaths = new Map<string, { path: string; yScale: d3.ScaleLinear<number, number> }>();
  busPolygons = new Map<string, BusPolygon[]>();
  gridLines: number[] = [];

  private waveforms = new Map<string, Point[]>();
  private busMap = new Map<string, PacketBus[]>();
  private fullDomain: [number, number] = [0, 1e-6];
  private start = 0;
  private stop = 1e-6;
  private minEdgeWidth = 1e-9;
  private zoomHandler?: D3ZoomHandler;
  private resizeObserver?: ResizeObserver;
  private readonly lineGenerator = d3.line<Point>().curve(d3.curveStepAfter);

  constructor(
    private cdr: ChangeDetectorRef,
    private zoomStateService: ZoomStateService
  ) {}

  ngAfterViewInit(): void {
    this.buildDemoCapture();
    this.measurePlot();
    this.resizePlot();
    this.setupZoom();

    this.resizeObserver = new ResizeObserver(() => {
      this.measurePlot();
      this.resizePlot();
    });
    this.resizeObserver.observe(this.waveformContainer.nativeElement);
  }

  ngOnDestroy(): void {
    this.zoomHandler?.destroy();
    this.resizeObserver?.disconnect();
  }

  trackLane(_index: number, lane: PlotLane): string {
    return lane.id;
  }

  onTool(tool: PlotTool, event: MouseEvent): void {
    event.stopPropagation();

    switch (tool) {
      case 'snapshot':
        this.capturePlot();
        break;
      case 'fit':
        this.fitView();
        break;
      case 'zoomIn':
        this.disablePanZoom();
        this.activeTool = 'zoomIn';
        break;
      case 'zoomOut':
        this.disablePanZoom();
        this.activeTool = 'zoomOut';
        break;
      case 'pan':
        this.activeTool = 'pan';
        this.setupZoom();
        break;
      case 'grid':
        this.gridEnabled = !this.gridEnabled;
        this.resizePlot();
        break;
      case 'cursor':
        this.cursorEnabled = !this.cursorEnabled;
        this.activeTool = 'cursor';
        this.disablePanZoom();
        if (!this.cursorEnabled) {
          this.cursorX = -1;
        }
        break;
      case 'hZoom':
        this.disablePanZoom();
        this.activeTool = 'hZoom';
        break;
      case 'bits':
        this.showBits = !this.showBits;
        this.activeTool = 'bits';
        this.resizePlot();
        break;
      case 'more':
        this.showMore = !this.showMore;
        this.activeTool = 'more';
        break;
    }

    this.cdr.markForCheck();
  }

  resetView(): void {
    this.showMore = false;
    this.fitView();
  }

  waveformMousedown(event: MouseEvent): void {
    if (event.button !== 0) {
      return;
    }

    const x = event.offsetX;
    if (this.activeTool === 'zoomIn' || this.activeTool === 'hZoom') {
      this.showOverlay = true;
      this.overlayx0 = x;
      this.overlayX = x;
      this.overlayWidth = 0;
      event.stopPropagation();
    } else if (this.activeTool === 'zoomOut') {
      const visibleRange = this.stop - this.start;
      const position = this.xScale.invert(x);
      this.start = position - 2 * visibleRange;
      this.stop = position + 2 * visibleRange;
      this.clampWindow();
      this.resizePlot();
      event.stopPropagation();
    } else if (this.activeTool === 'cursor' && this.cursorEnabled) {
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

  @HostListener('document:click')
  closeMore(): void {
    if (this.showMore) {
      this.showMore = false;
      this.cdr.markForCheck();
    }
  }

  private fitView(): void {
    this.start = this.fullDomain[0];
    this.stop = this.fullDomain[0] + this.minEdgeWidth * 1000;
    this.clampWindow();
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
      this.stop = this.start + this.minEdgeWidth * 100;
    }
  }

  private disablePanZoom(): void {
    this.zoomHandler?.destroy();
    this.zoomHandler = undefined;
    d3.select(this.waveformsvg.nativeElement).select('g.zoom-content').attr('transform', null);
  }

  private setupZoom(): void {
    this.disablePanZoom();
    this.activeTool = 'pan';

    const zoomCallbacks: D3ZoomHandlerCallbacks = {
      onTransform: transform => {
        d3.select(this.waveformsvg.nativeElement)
          .select('g.zoom-content')
          .attr('transform', `translate(${transform.x},0) scale(${transform.k},1)`);
        this.zoomStateService.updateTransform(transform);
      },
      onTransformEnd: async finalTransform => {
        const newDomain = finalTransform.rescaleX(this.xScale).domain();
        this.start = newDomain[0];
        this.stop = newDomain[1];
        this.clampWindow();
        this.resizePlot();
        this.zoomStateService.updateTransform(d3.zoomIdentity);
        this.zoomHandler?.reset();
        d3.select(this.waveformsvg.nativeElement).select('g.zoom-content').attr('transform', null);
      }
    };

    this.zoomHandler = new D3ZoomHandler(this.waveformsvg.nativeElement, zoomCallbacks, {
      scaleExtent: [0.1, 10]
    });
    this.zoomHandler.init();
  }

  private measurePlot(): void {
    const rect = this.waveformContainer.nativeElement.getBoundingClientRect();
    this.plotWidth = Math.max(200, rect.width);
    this.plotHeight = Math.max(200, rect.height);
    this.laneHeight = this.plotHeight / this.lanes.length;
  }

  private resizePlot(): void {
    const waveWidth = Math.max(1, this.plotWidth);
    this.xScale = d3.scaleLinear().domain([this.start, this.stop]).range([0, waveWidth]);

    this.lanes.forEach((lane, index) => {
      const yScale = d3
        .scaleLinear()
        .domain([-0.1, 1.1])
        .range([(index + 1) * this.laneHeight - 8, index * this.laneHeight + 8]);

      if (lane.kind === 'channel') {
        const waveform = this.waveforms.get(lane.id) ?? [];
        this.lineGenerator.x(d => this.xScale(d.x)).y(d => yScale(d.y));
        const visibleStart = 2 * this.start - this.stop;
        const visibleStop = 2 * this.stop - this.start;
        const points = toPoints(waveform, visibleStart, visibleStop, this.fullDomain);
        this.channelPaths.set(lane.id, {
          path: this.lineGenerator(points) ?? '',
          yScale
        });
      } else {
        const buses = this.busMap.get(lane.id) ?? [];
        this.busPolygons.set(
          lane.id,
          buses.map(packet => ({
            center: BusExtensions.getPolygonCenter(packet, this.xScale, yScale),
            path: BusExtensions.getPolygon(packet, this.xScale, yScale),
            content: packet.Content,
            startTime: packet.StartTime,
            endTime: packet.EndTime
          }))
        );
      }
    });

    this.gridLines = this.gridEnabled
      ? Array.from({ length: 9 }, (_, i) => ((i + 1) * waveWidth) / 10)
      : [];

    this.cdr.markForCheck();
  }

  /**
   * Same I3C capture path: edges -> toRawPoints (0/1) -> toPoints + curveStepAfter.
   * Demo edges stand in until MIL ResultService is wired.
   */
  private buildDemoCapture(): void {
    const edgeCount = 1000;
    this.minEdgeWidth = 40e-9;
    const start = 0;
    const stop = start + this.minEdgeWidth * edgeCount;
    this.fullDomain = [start, stop];
    this.start = start;
    this.stop = start + this.minEdgeWidth * 160;

    this.lanes.forEach((lane, laneIndex) => {
      const edges: number[] = [];
      let t = start;
      const period = this.minEdgeWidth * (6 + (laneIndex % 4));
      while (t < stop) {
        t += period * (0.6 + ((laneIndex + 1) % 3) * 0.2);
        edges.push(t);
      }

      this.waveforms.set(lane.id, toRawPoints(true, edges));

      if (lane.kind === 'bus') {
        const packets: PacketBus[] = [];
        const labels = lane.id === 'busA'
          ? ['CMD', '17', '000000000001', 'STS']
          : ['CMD', '2A', '000000001010', 'STS'];
        for (let i = 0; i < 24; i++) {
          const s = start + i * this.minEdgeWidth * 28;
          const e = s + this.minEdgeWidth * 18;
          packets.push({ StartTime: s, EndTime: e, Content: labels[i % labels.length] });
        }
        this.busMap.set(lane.id, packets);
      }
    });
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
