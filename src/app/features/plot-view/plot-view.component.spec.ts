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

  it('should expose ten plot operations in Figma order', () => {
    expect(component.tools.map(tool => tool.id)).toEqual([
      'snapshot',
      'expand',
      'select',
      'zoomIn',
      'zoomOut',
      'pan',
      'fit',
      'cursor',
      'grid',
      'flag'
    ]);
    expect(component.tools.map(tool => tool.order)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('should keep a compact wave with a 19px decode row under the bus', () => {
    expect(component.decodeHeight).toBe(19);
    expect(component.waveHeight).toBe(52);
  });

  it('should toggle grid and decode from the toolbar', () => {
    const event = new MouseEvent('click');
    component.onTool('grid', event);
    expect(component.gridEnabled).toBe(false);
    component.onTool('flag', event);
    expect(component.decodeEnabled).toBe(false);
    component.onPanClick(event);
    expect(component.activeTool).toBe('pan');
    component.onTool('expand', event);
    expect(component.isFullscreen).toBe(true);
  });

  it('should fit the full time window', () => {
    const start = component['fullDomain'][0];
    const end = component['fullDomain'][1];
    component.onFitClick();
    expect(component['start']).toBe(start);
    expect(component['stop']).toBe(end);
  });
    expect(typeof component.waveformMousemove).toBe('function');
    expect(typeof component.waveformMouseup).toBe('function');
    expect(typeof component.SaveImage).toBe('function');
    expect(component.cursorX).toBe(-1);
    expect(component.markers).toEqual([]);
  });
});
