import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlotViewComponent } from './plot-view.component';

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

  it('should keep a compact wave with a 19px decode row under the bus', () => {
    expect(component.decodeHeight).toBe(19);
    expect(component.waveHeight).toBe(52);
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
