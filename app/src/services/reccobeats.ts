/**
 * Cliente para la API pública de ReccoBeats (sin cuenta ni API key — ver
 * Stack_tecnico_proyecto.md §7). Es la fuente primaria de BPM/mood: reemplaza
 * al endpoint `audio-features` de Spotify, deprecado en nov. 2024.
 *
 * Verificado contra la API real (2026-09-02): `GET /v1/audio-features?ids=<spotify_ids>`
 * acepta Spotify track IDs directo. La respuesta trae `content: [...]`, y cada item
 * tiene un `id` interno de ReccoBeats (no el Spotify ID) — el único campo confiable
 * para saber a qué track de Spotify corresponde cada resultado es `href`
 * ("https://open.spotify.com/track/{spotifyId}"), así que el match se hace por ahí,
 * no por índice ni por el campo `id`.
 */

const API_BASE = "https://api.reccobeats.com/v1";

// La API no documenta un tope exacto de IDs por request; se usa el mismo tamaño de
// lote (40) que reporta la única integración de referencia encontrada, para no
// arriesgar un 429 en un lote gigante.
const BATCH_SIZE = 40;

export class ReccoBeatsApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ReccoBeatsApiError";
  }
}

export interface AudioFeatures {
  spotifyTrackId: string;
  tempo: number;
  valence: number;
  energy: number;
  danceability: number;
  acousticness: number;
  instrumentalness: number;
  liveness: number;
  loudness: number;
  speechiness: number;
}

interface ReccoBeatsAudioFeatureItem {
  href: string;
  tempo: number;
  valence: number;
  energy: number;
  danceability: number;
  acousticness: number;
  instrumentalness: number;
  liveness: number;
  loudness: number;
  speechiness: number;
}

interface ReccoBeatsAudioFeaturesResponse {
  content: ReccoBeatsAudioFeatureItem[];
}

function extractSpotifyTrackId(href: string): string | null {
  const match = /\/track\/([A-Za-z0-9]+)/.exec(href);
  return match?.[1] ?? null;
}

async function requestBatch(ids: string[], isRetry = false): Promise<ReccoBeatsAudioFeaturesResponse> {
  const response = await fetch(`${API_BASE}/audio-features?ids=${ids.join(",")}`, {
    headers: { Accept: "application/json" },
  });

  if (response.status === 429 && !isRetry) {
    const retryAfterSeconds = Number(response.headers.get("Retry-After") ?? "1");
    await new Promise((resolve) => setTimeout(resolve, retryAfterSeconds * 1000));
    return requestBatch(ids, true);
  }

  if (!response.ok) {
    throw new ReccoBeatsApiError(`ReccoBeats respondió ${response.status}`, response.status);
  }

  return response.json() as Promise<ReccoBeatsAudioFeaturesResponse>;
}

/**
 * Trae audio features (tempo/BPM + mood: valence, energy, danceability, etc.) para
 * hasta cientos de tracks de Spotify, en lotes. No todos los IDs pedidos tienen
 * cobertura en ReccoBeats (ver nota de cobertura en Stack_tecnico_proyecto.md §7) —
 * los que no aparecen en `content` simplemente se omiten del resultado, sin error.
 */
export async function getAudioFeatures(spotifyTrackIds: string[]): Promise<AudioFeatures[]> {
  const uniqueIds = [...new Set(spotifyTrackIds)];
  if (uniqueIds.length === 0) return [];

  const results: AudioFeatures[] = [];
  for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
    const batch = uniqueIds.slice(i, i + BATCH_SIZE);
    const { content } = await requestBatch(batch);
    for (const item of content) {
      const spotifyTrackId = extractSpotifyTrackId(item.href);
      if (!spotifyTrackId) continue;
      results.push({
        spotifyTrackId,
        tempo: item.tempo,
        valence: item.valence,
        energy: item.energy,
        danceability: item.danceability,
        acousticness: item.acousticness,
        instrumentalness: item.instrumentalness,
        liveness: item.liveness,
        loudness: item.loudness,
        speechiness: item.speechiness,
      });
    }
  }
  return results;
}
