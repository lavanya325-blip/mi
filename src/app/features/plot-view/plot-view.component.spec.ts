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

  it('should apply plot commands from the app toolbar event', () => {
    document.dispatchEvent(new CustomEvent('mil-plot-tool', { detail: 'grid' }));
    expect(component.gridEnabled).toBe(false);
    document.dispatchEvent(new CustomEvent('mil-plot-tool', { detail: 'move' }));
    expect(component.activeTool).toBe('move');
  });

  it('should expose I3C-compatible mouse handlers', () => {
    expect(typeof component.waveformMousemove).toBe('function');
    expect(typeof component.waveformMouseup).toBe('function');
    expect(typeof component.SaveImage).toBe('function');
    expect(component.cursorX).toBe(-1);
    expect(component.markers).toEqual([]);
  });
});
