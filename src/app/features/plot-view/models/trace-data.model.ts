import { PacketBus } from './plot-track.model';

/** Same shape I3C uses after ResultService.getEdges(). */
export interface EdgeCollection {
  firstEdgeRise: boolean;
  edges: number[];
}

/**
 * Capture/trace payload from ResultService / imported .trace.
 * Plot View stays empty until loadTrace() or [capture] is called.
 */
export interface TraceData {
  referenceTime: number;
  startTime: number;
  endTime: number;
  minEdgeWidth: number;
  channels: Record<string, EdgeCollection>;
  buses: Record<string, PacketBus[]>;
}

/**
 * Used to return fake Bus A/B + CH1–4 square waves.
 * Kept only so leftover `ngAfterViewInit` code that still does
 * `this.loadTrace(createSampleTrace())` does not draw anything.
 * Returns null → Plot View shows "No Data Available".
 */
export function createSampleTrace(): TraceData | null {
  return null;
}
