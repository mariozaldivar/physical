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

/**
 * Igual que `sortByBpmDistance` + slice, pero evita repetir canciones de
 * `recentlyPlayedIds` (ver playHistoryStore.ts) mientras haya suficientes
 * candidatos "frescos" para llenar `count`. Si no los hay — catálogo o
 * selección de playlists chica — rellena con los ya sonados en vez de dejar
 * la cola corta: mejor repetir algo que mostrar menos matches de los pedidos.
 */
export function pickAvoidingRepeats<T extends { id: string; bpm?: number }>(
  candidates: T[],
  targetBpm: number,
  count: number,
  recentlyPlayedIds: string[],
): T[] {
  const recentSet = new Set(recentlyPlayedIds);
  const fresh = sortByBpmDistance(
    candidates.filter((candidate) => !recentSet.has(candidate.id)),
    targetBpm,
  );
  if (fresh.length >= count) return fresh.slice(0, count);

  const freshIds = new Set(fresh.map((candidate) => candidate.id));
  const rest = sortByBpmDistance(
    candidates.filter((candidate) => !freshIds.has(candidate.id)),
    targetBpm,
  );
  return [...fresh, ...rest].slice(0, count);
}
