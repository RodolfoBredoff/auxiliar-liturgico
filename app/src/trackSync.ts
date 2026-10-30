export type TimelineMarker = { start_ms: number; block_index: number };
export type SongTimeline = { markers: TimelineMarker[] };

export function parseTimeline(raw: string | null | undefined): SongTimeline | null {
  if (!raw?.trim()) return null;
  try {
    const data = JSON.parse(raw) as SongTimeline;
    if (!Array.isArray(data.markers)) return null;
    return data;
  } catch {
    return null;
  }
}

/** Bloco de letra correspondente à posição na faixa de referência (ms). */
export function blockIndexForPos(timeline: SongTimeline, posMs: number): number {
  let block = 0;
  const sorted = [...timeline.markers].sort((a, b) => a.start_ms - b.start_ms);
  for (const marker of sorted) {
    if (posMs >= marker.start_ms) block = marker.block_index;
  }
  return block;
}
