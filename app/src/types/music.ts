export type { PulseZone } from "../theme/theme";
import type { PulseZone } from "../theme/theme";

/** Estado de conexión BLE con la banda (Heart Rate Service 0x180D). */
export type BandConnectionState = "connected" | "scanning" | "disconnected";

export interface BpmReading {
  bpm: number;
  zone: PulseZone;
  connection: BandConnectionState;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  albumArtUrl?: string;
  /** Undefined para playback real: Spotify deprecó audio-features (ver spotifyPlayback.ts). */
  bpm?: number;
  durationMs: number;
  progressMs?: number;
}

export interface QueueTrack extends Track {
  /** Por qué esta canción fue elegida para la cola, en el idioma del cross-referencing BPM. */
  matchReason?: string;
}
