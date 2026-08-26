import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlotViewComponent } from './plot-view.component';
import { createSampleTrace } from './models/trace-data.model';

describe('PlotViewComponent', () => {
  let component: PlotViewComponent;
  let fixture: ComponentFixture<PlotViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlotViewComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(PlotViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not plot a sample wave until backend data is loaded', () => {
    expect(component.hasData).toBe(false);
    component.loadTrace(createSampleTrace());
    expect(component.hasData).toBe(false);
    expect(component.wavePaths.size).toBe(0);
    expect(component.busPolygons.size).toBe(0);
  });

  it('should show bus lanes and plot operations before a trace is loaded', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Bus A');
    expect(text).toContain('Bus B');
    expect(text).toContain('Channel 1');
    expect(component.tools.length).toBe(10);
    expect(text).not.toContain('0000000000001');
  });

  it('should expose ten plot operations on the plot view', () => {
    expect(component.tools.map(tool => tool.id)).toEqual([
      'snapshot',
      'expand',
      'select',
      'zoomIn',
      'zoomOut',
      'pan',
      'move',
      'cursor',
      'grid',
      'flag'
    ]);
  });

  it('should expose I3C-compatible mouse handlers', () => {
    expect(typeof component.waveformMousemove).toBe('function');
    expect(typeof component.waveformMouseup).toBe('function');
    expect(typeof component.SaveImage).toBe('function');
    expect(component.cursorX).toBe(-1);
    expect(component.markers).toEqual([]);
  });
});
