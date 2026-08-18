import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlotViewComponent } from './plot-view.component';
import { PlotCommandService } from './plot-command.service';

describe('PlotViewComponent', () => {
  let component: PlotViewComponent;
  let fixture: ComponentFixture<PlotViewComponent>;
  let plotCommands: PlotCommandService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlotViewComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(PlotViewComponent);
    component = fixture.componentInstance;
    plotCommands = TestBed.inject(PlotCommandService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should keep a compact wave with a 19px decode row under the bus', () => {
    expect(component.decodeHeight).toBe(19);
    expect(component.waveHeight).toBe(52);
  });

  it('should apply plot commands from the app toolbar', () => {
    plotCommands.run('grid');
    fixture.detectChanges();
    expect(component.gridEnabled).toBe(false);
    plotCommands.run('pan');
    expect(component.activeTool).toBe('pan');
    plotCommands.run('move');
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
