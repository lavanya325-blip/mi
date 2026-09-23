import { PacketBus } from './plot-track.model';

/** Same shape I3C uses after ResultService.getEdges(). */
export interface EdgeCollection {
  firstEdgeRise: boolean;
  edges: number[];
}

/**
 * Capture payload. Parent maps ResultService / imported .trace into this.
 * Plot View does not invent edges; createSampleTrace stays empty like I3C.
 */
export interface TraceData {
  referenceTime: number;
  startTime: number;
  endTime: number;
  minEdgeWidth: number;
  channels: Record<string, EdgeCollection>;
  buses: Record<string, PacketBus[]>;
}

export function createSampleTrace(): TraceData | null {
  return null;
}
