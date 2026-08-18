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
      'move',
      'cursor',
      'grid',
      'flag'
    ]);
    expect(component.tools.map(tool => tool.order)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('should use a 19px decode row', () => {
    expect(component.decodeHeight).toBe(19);
  });

  it('should toggle grid and decode from the toolbar', () => {
    const event = new MouseEvent('click');
    component.onTool('grid', event);
    expect(component.gridEnabled).toBe(false);
    component.onTool('flag', event);
    expect(component.decodeEnabled).toBe(false);
    component.onTool('pan', event);
    expect(component.activeTool).toBe('pan');
    component.onTool('expand', event);
    expect(component.isFullscreen).toBe(true);
  });
});
