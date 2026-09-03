/**
 * Criterio de match compartido entre el flujo simulado (mockPlayback.ts) y el
 * real (bpmQueue.ts): "por qué esta canción entró a la cola", en el mismo
 * idioma para los dos casos.
 */
const CLOSE_ENOUGH_BPM = 3;

export function bpmMatchReason(candidateBpm: number, targetBpm: number): string {
  if (Math.abs(candidateBpm - targetBpm) <= CLOSE_ENOUGH_BPM) return "mantiene el ritmo";
  return candidateBpm > targetBpm ? "sube el ritmo" : "baja el ritmo";
}

/** Ordena por cercanía al BPM objetivo — el primero es el mejor match. */
export function sortByBpmDistance<T extends { bpm?: number }>(tracks: T[], targetBpm: number): T[] {
  return [...tracks].sort(
    (a, b) => Math.abs((a.bpm ?? 0) - targetBpm) - Math.abs((b.bpm ?? 0) - targetBpm),
  );
}
