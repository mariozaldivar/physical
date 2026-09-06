import { getAudioFeaturesForTracks } from "./audioFeatures";
import { getCachedLikedSongs, getCachedTracksForSelectedPlaylists, type LibraryTrack } from "./spotifyLibrary";
import { bpmMatchReason, pickAvoidingRepeats } from "../utils/bpmMatch";
import { usePlayHistoryStore } from "../store/playHistoryStore";
import type { QueueTrack } from "../types/music";

/**
 * Cross-referencing real por BPM (ver Planeacion_proyecto.md): candidatos =
 * Liked Songs + canciones de las playlists que el usuario marcó en
 * PlaylistSelectionScreen. BPM de cada candidato vía ReccoBeats, cache-first
 * (audioFeatures.ts) — sólo pega a la red la primera vez que se ve cada track.
 */

// Tope de candidatos a resolver por vez — sin esto, una librería grande podría
// significar cientos de llamadas a ReccoBeats en un solo cálculo de cola. Con
// esto alcanza de sobra para encontrar buenos matches sin que la primera
// sesión se sienta lenta (ver "costo de sync completa" en Informe_retrieval_datos.md).
const MAX_CANDIDATES = 150;

/** Tamaño del batch de "siguientes canciones" — ver store/spotifyStore.ts, que lo mantiene siempre lleno reponiendo de a una. */
export const DEFAULT_QUEUE_BATCH_SIZE = 3;

function toTrack(track: LibraryTrack): Omit<QueueTrack, "bpm" | "matchReason"> {
  return {
    id: track.id,
    title: track.name,
    artist: track.artists,
    albumArtUrl: track.imageUrl ?? undefined,
    durationMs: track.durationMs,
  };
}

async function getCandidatePool(): Promise<LibraryTrack[]> {
  const [likedSongs, selectedPlaylistTracks] = await Promise.all([
    getCachedLikedSongs(),
    getCachedTracksForSelectedPlaylists(),
  ]);
  const byId = new Map<string, LibraryTrack>();
  for (const track of [...likedSongs, ...selectedPlaylistTracks]) {
    byId.set(track.id, track);
  }
  return [...byId.values()];
}

/**
 * Arma la cola real: los `count` candidatos (Liked Songs + playlists
 * seleccionadas) cuyo BPM real está más cerca del BPM objetivo, con
 * `matchReason` explicando el porqué. Devuelve `[]` sin error si todavía no
 * hay candidatos (nada seleccionado / nada sincronizado) — no es una falla,
 * es un estado válido que la UI ya sabe mostrar.
 *
 * Evita repetir las últimas canciones reproducidas/encoladas (ver
 * playHistoryStore.ts y Stack_tecnico_proyecto.md §7) — si eso deja muy pocos
 * candidatos frescos, `pickAvoidingRepeats` rellena con repetidos antes que
 * devolver una cola corta.
 */
export async function buildQueueForBpm(
  targetBpm: number,
  excludeTrackId?: string,
  count = DEFAULT_QUEUE_BATCH_SIZE,
): Promise<QueueTrack[]> {
  const pool = await getCandidatePool();
  const candidates = pool.filter((track) => track.id !== excludeTrackId).slice(0, MAX_CANDIDATES);
  if (candidates.length === 0) return [];

  const features = await getAudioFeaturesForTracks(candidates.map((track) => track.id));

  const withBpm = candidates
    .map((track) => ({ track, bpm: features.get(track.id)?.tempo }))
    .filter((entry): entry is { track: LibraryTrack; bpm: number } => entry.bpm !== undefined);

  const recentlyPlayedIds = usePlayHistoryStore.getState().recentTrackIds;
  return pickAvoidingRepeats(
    withBpm.map(({ track, bpm }) => ({ ...toTrack(track), bpm })),
    targetBpm,
    count,
    recentlyPlayedIds,
  ).map((track) => ({ ...track, matchReason: bpmMatchReason(track.bpm ?? targetBpm, targetBpm) }));
}
