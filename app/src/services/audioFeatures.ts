import { getDb } from "./db";
import { getAudioFeatures, type AudioFeatures } from "./reccobeats";

/**
 * Cache local (SQLite) de audio features por track — ver
 * Stack_tecnico_proyecto.md §7. Lookup lazy, igual patrón que
 * `getPlaylistItems` en spotifyLibrary.ts: nunca se re-fetchea un track que
 * ya tenemos guardado.
 */

interface AudioFeaturesRow {
  spotify_track_id: string;
  tempo: number;
  valence: number | null;
  energy: number | null;
  danceability: number | null;
  acousticness: number | null;
  instrumentalness: number | null;
  liveness: number | null;
  loudness: number | null;
  speechiness: number | null;
}

function fromRow(row: AudioFeaturesRow): AudioFeatures {
  return {
    spotifyTrackId: row.spotify_track_id,
    tempo: row.tempo,
    valence: row.valence ?? 0,
    energy: row.energy ?? 0,
    danceability: row.danceability ?? 0,
    acousticness: row.acousticness ?? 0,
    instrumentalness: row.instrumentalness ?? 0,
    liveness: row.liveness ?? 0,
    loudness: row.loudness ?? 0,
    speechiness: row.speechiness ?? 0,
  };
}

async function getCachedAudioFeatures(spotifyTrackIds: string[]): Promise<Map<string, AudioFeatures>> {
  if (spotifyTrackIds.length === 0) return new Map();
  const db = await getDb();
  const placeholders = spotifyTrackIds.map(() => "?").join(",");
  const rows = await db.getAllAsync<AudioFeaturesRow>(
    `SELECT spotify_track_id, tempo, valence, energy, danceability, acousticness,
            instrumentalness, liveness, loudness, speechiness
     FROM track_audio_features WHERE spotify_track_id IN (${placeholders})`,
    spotifyTrackIds,
  );
  return new Map(rows.map((row) => [row.spotify_track_id, fromRow(row)]));
}

async function cacheAudioFeatures(features: AudioFeatures[]): Promise<void> {
  if (features.length === 0) return;
  const db = await getDb();
  const now = Date.now();
  for (const feature of features) {
    await db.runAsync(
      `INSERT INTO track_audio_features
         (spotify_track_id, source, tempo, valence, energy, danceability, acousticness,
          instrumentalness, liveness, loudness, speechiness, fetched_at)
       VALUES (?, 'reccobeats', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(spotify_track_id) DO UPDATE SET
         source = excluded.source, tempo = excluded.tempo, valence = excluded.valence,
         energy = excluded.energy, danceability = excluded.danceability,
         acousticness = excluded.acousticness, instrumentalness = excluded.instrumentalness,
         liveness = excluded.liveness, loudness = excluded.loudness,
         speechiness = excluded.speechiness, fetched_at = excluded.fetched_at`,
      [
        feature.spotifyTrackId,
        feature.tempo,
        feature.valence,
        feature.energy,
        feature.danceability,
        feature.acousticness,
        feature.instrumentalness,
        feature.liveness,
        feature.loudness,
        feature.speechiness,
        now,
      ],
    );
  }
}

/**
 * Lectura pura del cache local, sin red — para pintar BPM en una tarjeta sin
 * bloquear la UI a un fetch.
 */
export async function getCachedTrackBpm(spotifyTrackId: string): Promise<number | null> {
  const cached = await getCachedAudioFeatures([spotifyTrackId]);
  return cached.get(spotifyTrackId)?.tempo ?? null;
}

/**
 * Cache-first: devuelve lo que ya tengamos localmente y sólo pega a ReccoBeats
 * por los tracks que falten. Pensado para llamarse con los tracks visibles en
 * pantalla (now-playing, una playlist), no con toda la librería de una vez.
 */
export async function getAudioFeaturesForTracks(spotifyTrackIds: string[]): Promise<Map<string, AudioFeatures>> {
  const uniqueIds = [...new Set(spotifyTrackIds)];
  const cached = await getCachedAudioFeatures(uniqueIds);
  const missingIds = uniqueIds.filter((id) => !cached.has(id));
  if (missingIds.length === 0) return cached;

  const fetched = await getAudioFeatures(missingIds);
  await cacheAudioFeatures(fetched);
  for (const feature of fetched) {
    cached.set(feature.spotifyTrackId, feature);
  }
  return cached;
}
