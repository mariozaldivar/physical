import { spotifyGet } from "./spotifyApi";
import type { Track } from "../types/music";

interface SpotifyImage {
  url: string;
}

interface SpotifyTrackItem {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { images: SpotifyImage[] };
  duration_ms: number;
}

interface CurrentlyPlayingResponse {
  is_playing: boolean;
  progress_ms: number | null;
  item: SpotifyTrackItem | null;
  currently_playing_type: "track" | "episode" | "ad" | "unknown";
}

export interface LivePlayback {
  track: Track;
  isPlaying: boolean;
}

/**
 * Playback en vivo real (no simulado) vía GET /me/player/currently-playing.
 * `track.bpm` queda undefined a propósito: Spotify deprecó `audio-features`
 * en nov. 2024 y no hay forma pública de obtener el tempo de una canción
 * arbitraria en tiempo real (ver riesgo técnico en Stack_tecnico_proyecto.md
 * §5 y el informe de datos). El cross-referencing por BPM sigue siendo mock.
 */
export async function getCurrentlyPlaying(accessToken: string): Promise<LivePlayback | null> {
  const response = await spotifyGet<CurrentlyPlayingResponse | null>(
    "/me/player/currently-playing",
    accessToken,
  );

  if (!response || !response.item || response.currently_playing_type !== "track") {
    return null;
  }

  const { item } = response;
  return {
    isPlaying: response.is_playing,
    track: {
      id: item.id,
      title: item.name,
      artist: item.artists.map((artist) => artist.name).join(", "),
      albumArtUrl: item.album.images[0]?.url,
      durationMs: item.duration_ms,
      progressMs: response.progress_ms ?? 0,
    },
  };
}
