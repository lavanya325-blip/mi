import { PacketBus } from './plot-track.model';

/** Same shape I3C uses after ResultService.getEdges(). */
export interface EdgeCollection {
  firstEdgeRise: boolean;
  edges: number[];
}

/**
 * Capture/trace payload. Replace createSampleTrace() with
 * ResultService / imported .trace file mapped into this type.
 */
export interface TraceData {
  referenceTime: number;
  startTime: number;
  endTime: number;
  minEdgeWidth: number;
  channels: Record<string, EdgeCollection>;
  buses: Record<string, PacketBus[]>;
}

export function createSampleTrace(): TraceData {
  const minEdgeWidth = 50e-9;
  const startTime = 0;
  const endTime = minEdgeWidth * 4000;
  const referenceTime = startTime;

  const clockEdges = (period: number, phase = 0): number[] => {
    const edges: number[] = [];
    for (let t = startTime + phase; t <= endTime; t += period) {
      edges.push(t);
    }
    return edges;
  };

  const busPeriod = minEdgeWidth * 6;
  const busAEdges = clockEdges(busPeriod, 0);
  const busBEdges = clockEdges(busPeriod, minEdgeWidth * 2);

  return {
    referenceTime,
    startTime,
    endTime,
    minEdgeWidth,
    channels: {
      busA: { firstEdgeRise: true, edges: busAEdges },
      busB: { firstEdgeRise: true, edges: busBEdges },
      ch1: { firstEdgeRise: true, edges: clockEdges(minEdgeWidth * 2, 0) },
      ch2: { firstEdgeRise: true, edges: clockEdges(minEdgeWidth * 2, minEdgeWidth * 0.4) },
      ch3: { firstEdgeRise: true, edges: clockEdges(minEdgeWidth * 2.4, minEdgeWidth * 0.2) },
      ch4: { firstEdgeRise: true, edges: clockEdges(minEdgeWidth * 2.2, minEdgeWidth * 0.6) }
    },
    buses: {
      busA: buildStatusWords(startTime, endTime, minEdgeWidth, ['17', 'D', 'S', '000000000001'], 0),
      busB: buildStatusWords(startTime, endTime, minEdgeWidth, ['2A', 'D', 'S', '000000001010'], minEdgeWidth * 8)
    }
  };
}

function buildStatusWords(
  startTime: number,
  endTime: number,
  minEdgeWidth: number,
  labels: string[],
  offset: number
): PacketBus[] {
  const packets: PacketBus[] = [];
  const word = minEdgeWidth * 24;
  const gap = minEdgeWidth * 8;
  let t = startTime + offset;
  let i = 0;
  while (t + word < endTime) {
    packets.push({
      StartTime: t,
      EndTime: t + word,
      Content: labels[i % labels.length]
    });
    t += word + gap;
    i++;
  }
  return packets;
}
