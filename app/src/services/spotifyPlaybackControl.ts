/**
 * Control de playback y cola vía Spotify Web API — helpers puros (sin estado
 * de React, ver hooks/usePlaybackControl.ts para eso). Preparados para cuando
 * exista el disparador automático por BPM (ver Planeacion_proyecto.md: "las
 * añade a la cola, o si el cambio es demasiado drástico, skippea a la
 * siguiente canción"), que todavía no existe — hoy nada llama a estas
 * funciones automáticamente.
 *
 * Requiere Spotify Premium del lado del usuario (documentado así en cada
 * endpoint del API) y los scopes `user-modify-playback-state` /
 * `user-read-playback-state` (ver spotifyAuth.ts).
 *
 * Paths y shapes verificados contra la documentación oficial del Web API
 * (2026-09-03) — ver reglas de integración con Spotify en CLAUDE.md.
 */

import { buildQuery, spotifyGet, spotifyMutate } from "./spotifyApi";
import type { Track } from "../types/music";

export interface SpotifyDevice {
  id: string | null;
  name: string;
  type: string;
  isActive: boolean;
  isRestricted: boolean;
  volumePercent: number | null;
}

interface SpotifyDeviceObject {
  id: string | null;
  name: string;
  type: string;
  is_active: boolean;
  is_restricted: boolean;
  volume_percent: number | null;
}

/** `GET /me/player/devices` — para elegir a qué device transferir playback. */
export async function getAvailableDevices(accessToken: string): Promise<SpotifyDevice[]> {
  const response = await spotifyGet<{ devices: SpotifyDeviceObject[] }>("/me/player/devices", accessToken);
  return response.devices.map((device) => ({
    id: device.id,
    name: device.name,
    type: device.type,
    isActive: device.is_active,
    isRestricted: device.is_restricted,
    volumePercent: device.volume_percent,
  }));
}

/** `PUT /me/player` — mueve la reproducción a otro device (Spotify Connect). */
export async function transferPlayback(accessToken: string, deviceId: string, play = false): Promise<void> {
  await spotifyMutate("PUT", "/me/player", accessToken, { device_ids: [deviceId], play });
}

export interface ResumePlaybackOptions {
  deviceId?: string;
  /** URI de álbum/artista/playlist a reproducir como contexto. */
  contextUri?: string;
  /** Tracks puntuales a reproducir (alternativa a `contextUri`). */
  uris?: string[];
  positionMs?: number;
}

/** `PUT /me/player/play` — sin opciones, reanuda donde se quedó; con `uris`/`contextUri`, arranca eso. */
export async function resumePlayback(accessToken: string, options: ResumePlaybackOptions = {}): Promise<void> {
  const { deviceId, contextUri, uris, positionMs } = options;
  const hasBody = contextUri !== undefined || uris !== undefined || positionMs !== undefined;
  await spotifyMutate(
    "PUT",
    `/me/player/play${buildQuery({ device_id: deviceId })}`,
    accessToken,
    hasBody
      ? { context_uri: contextUri, uris, position_ms: positionMs }
      : undefined,
  );
}

/** `PUT /me/player/pause` */
export async function pausePlayback(accessToken: string, deviceId?: string): Promise<void> {
  await spotifyMutate("PUT", `/me/player/pause${buildQuery({ device_id: deviceId })}`, accessToken);
}

/** `POST /me/player/next` */
export async function skipToNext(accessToken: string, deviceId?: string): Promise<void> {
  await spotifyMutate("POST", `/me/player/next${buildQuery({ device_id: deviceId })}`, accessToken);
}

/** `POST /me/player/previous` */
export async function skipToPrevious(accessToken: string, deviceId?: string): Promise<void> {
  await spotifyMutate("POST", `/me/player/previous${buildQuery({ device_id: deviceId })}`, accessToken);
}

/** `PUT /me/player/seek` */
export async function seekToPosition(accessToken: string, positionMs: number, deviceId?: string): Promise<void> {
  await spotifyMutate(
    "PUT",
    `/me/player/seek${buildQuery({ position_ms: positionMs, device_id: deviceId })}`,
    accessToken,
  );
}

/** `POST /me/player/queue` — encola una canción puntual (`spotify:track:{id}`). */
export async function addToQueue(accessToken: string, trackUri: string, deviceId?: string): Promise<void> {
  await spotifyMutate("POST", `/me/player/queue${buildQuery({ uri: trackUri, device_id: deviceId })}`, accessToken);
}

interface SpotifyQueueTrackObject {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { images: { url: string }[] } | null;
  duration_ms: number;
  type: "track" | "episode";
}

interface SpotifyQueueResponse {
  currently_playing: SpotifyQueueTrackObject | null;
  queue: SpotifyQueueTrackObject[];
}

export interface PlaybackQueue {
  currentlyPlaying: Track | null;
  queue: Track[];
}

function toTrack(item: SpotifyQueueTrackObject): Track {
  return {
    id: item.id,
    title: item.name,
    artist: item.artists.map((artist) => artist.name).join(", "),
    albumArtUrl: item.album?.images?.[0]?.url,
    durationMs: item.duration_ms,
  };
}

/**
 * `GET /me/player/queue` — usa el scope `user-read-currently-playing` que ya
 * se pedía antes de esta instrucción, no hace falta `user-read-playback-state`
 * para este endpoint en particular.
 */
export async function getQueue(accessToken: string): Promise<PlaybackQueue> {
  const response = await spotifyGet<SpotifyQueueResponse>("/me/player/queue", accessToken);
  return {
    currentlyPlaying:
      response.currently_playing && response.currently_playing.type === "track"
        ? toTrack(response.currently_playing)
        : null,
    // Episodios (podcasts) se omiten: la cola de Physical es de canciones, no de podcasts.
    queue: response.queue.filter((item) => item.type === "track").map(toTrack),
  };
}
