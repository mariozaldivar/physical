import { create } from "zustand";
import { getAudioFeaturesForTracks } from "../services/audioFeatures";
import { buildQueueForBpm } from "../services/bpmQueue";
import { clearSession, type SpotifySession } from "../services/spotifyAuth";
import { getCurrentlyPlaying, type LivePlayback } from "../services/spotifyPlayback";
import { addToQueue, getAvailableDevices } from "../services/spotifyPlaybackControl";
import { SpotifyApiError } from "../services/spotifyApi";
import { usePlayHistoryStore } from "./playHistoryStore";
import {
  getCachedLikedSongs,
  getCachedPlaylists,
  getPlaylistItems,
  setPlaylistSelectedForBpm,
  syncLikedSongs,
  syncPlaylists,
  type LibraryPlaylist,
  type LibraryTrack,
} from "../services/spotifyLibrary";
import type { QueueTrack } from "../types/music";

// Cuánto tiene que moverse el BPM leído desde el último cálculo para que valga
// la pena rearmar la cola — evita re-pegarle a ReccoBeats/recalcular por cada
// jitter de 1-2 BPM del sensor (real o simulado). No aplica al arranque
// (`lastQueueBpm === null` siempre recalcula).
const BPM_RECOMPUTE_THRESHOLD = 4;

interface SpotifyState {
  session: SpotifySession | null;
  playlists: LibraryPlaylist[];
  likedSongs: LibraryTrack[];
  librarySyncing: boolean;
  libraryError: string | null;
  nowPlaying: LivePlayback | null;

  /** Cola real armada por cross-referencing de BPM (Liked Songs + playlists seleccionadas). */
  queue: QueueTrack[];
  queueBuilding: boolean;
  queueError: string | null;
  lastQueueBpm: number | null;
  /** Para mostrar "se agregó X a tu cola" sin repetir el mismo track en cada tick. */
  lastAutoQueuedTrack: QueueTrack | null;

  setSession: (session: SpotifySession | null) => void;
  /** Cierra la sesión de Spotify guardada — necesario para re-loguear y pedir scopes nuevos. */
  signOut: () => Promise<void>;
  /** Lectura instantánea del cache local (offline-first), sin pegarle a la API. */
  loadCachedLibrary: () => Promise<void>;
  /** Fetch completo a Spotify + upsert al cache local (ver informe de datos para estrategia). */
  syncLibrary: () => Promise<void>;
  refreshNowPlaying: () => Promise<void>;
  /** Optimista: refleja el toggle en memoria de inmediato y lo persiste en SQLite. */
  togglePlaylistSelection: (playlistId: string) => Promise<void>;
  /** Rearma `queue` según el BPM actual (no-op si no se movió lo suficiente desde el último cálculo). */
  refreshQueueForBpm: (targetBpm: number, excludeTrackId?: string) => Promise<void>;
}

export const useSpotifyStore = create<SpotifyState>((set, get) => ({
  session: null,
  playlists: [],
  likedSongs: [],
  librarySyncing: false,
  libraryError: null,
  nowPlaying: null,

  queue: [],
  queueBuilding: false,
  queueError: null,
  lastQueueBpm: null,
  lastAutoQueuedTrack: null,

  setSession: (session) =>
    set({
      session,
      nowPlaying: session ? get().nowPlaying : null,
      queue: session ? get().queue : [],
      lastQueueBpm: null,
      lastAutoQueuedTrack: null,
      queueError: null,
    }),

  signOut: async () => {
    await clearSession();
    get().setSession(null);
  },

  loadCachedLibrary: async () => {
    const [playlists, likedSongs] = await Promise.all([getCachedPlaylists(), getCachedLikedSongs()]);
    set({ playlists, likedSongs });
  },

  syncLibrary: async () => {
    const { session } = get();
    if (!session) return;
    set({ librarySyncing: true, libraryError: null });
    try {
      const [playlists, likedSongs] = await Promise.all([
        syncPlaylists(session.accessToken),
        syncLikedSongs(session.accessToken),
      ]);
      set({ playlists, likedSongs });
    } catch (error) {
      set({
        libraryError:
          error instanceof Error ? error.message : "No se pudo sincronizar tu biblioteca de Spotify.",
      });
    } finally {
      set({ librarySyncing: false });
    }
  },

  refreshNowPlaying: async () => {
    const { session } = get();
    if (!session) return;
    try {
      const previousTrackId = get().nowPlaying?.track.id;
      const live = await getCurrentlyPlaying(session.accessToken);
      set({ nowPlaying: live });

      // Registra el track como "reproducido" apenas Spotify confirma que
      // cambió — así el historial refleja lo que de verdad sonó, no sólo lo
      // que Physical propuso (ver playHistoryStore.ts).
      if (live && live.track.id !== previousTrackId) {
        usePlayHistoryStore.getState().recordPlayed(live.track.id);
      }

      // BPM real vía ReccoBeats (ver services/audioFeatures.ts): cache-first, así
      // que en la práctica sólo pega a la red la primera vez que suena cada track.
      // No bloquea el poll de now-playing (corre aparte, en segundo plano).
      if (live) {
        getAudioFeaturesForTracks([live.track.id])
          .then((features) => {
            const bpm = features.get(live.track.id)?.tempo;
            if (bpm === undefined) return;
            const stillSameTrack = get().nowPlaying?.track.id === live.track.id;
            if (!stillSameTrack) return;
            set((state) => ({
              nowPlaying: state.nowPlaying
                ? { ...state.nowPlaying, track: { ...state.nowPlaying.track, bpm } }
                : state.nowPlaying,
            }));
          })
          .catch(() => {
            // Sin cobertura en ReccoBeats o falla de red puntual: se queda sin BPM,
            // NowPlayingCard ya maneja `bpm: undefined` (badge "BPM no disponible").
          });
      }
    } catch {
      // Un fallo puntual de poll no debe tirar la UI ni acumular errores en pantalla.
    }
  },

  togglePlaylistSelection: async (playlistId) => {
    const current = get().playlists.find((playlist) => playlist.id === playlistId);
    if (!current) return;
    const selectedForBpm = !current.selectedForBpm;

    set({
      playlists: get().playlists.map((playlist) =>
        playlist.id === playlistId ? { ...playlist, selectedForBpm } : playlist,
      ),
    });
    await setPlaylistSelectedForBpm(playlistId, selectedForBpm);

    // Al seleccionar una playlist hay que traer sus canciones al menos una vez
    // para que buildQueueForBpm tenga de dónde elegir (getCachedTracksForSelectedPlaylists
    // es lectura pura de cache, no dispara red por su cuenta). Best-effort: si
    // falla (red, playlist borrada), simplemente esa playlist no aporta candidatos
    // todavía — no se bloquea el toggle por esto.
    const { session } = get();
    if (selectedForBpm && session) {
      getPlaylistItems(session.accessToken, playlistId).catch(() => {});
    }
  },

  refreshQueueForBpm: async (targetBpm, excludeTrackId) => {
    const { session, lastQueueBpm, queueBuilding } = get();
    if (!session || queueBuilding) return;
    if (lastQueueBpm !== null && Math.abs(targetBpm - lastQueueBpm) < BPM_RECOMPUTE_THRESHOLD) return;

    set({ queueBuilding: true, queueError: null });
    try {
      const queue = await buildQueueForBpm(targetBpm, excludeTrackId);
      set({ queue, lastQueueBpm: targetBpm });

      const top = queue[0];
      const alreadyHandled = get().lastAutoQueuedTrack?.id === top?.id;
      if (top && !alreadyHandled) {
        await enqueueBpmMatch(session.accessToken, top, set);
      }
    } catch (error) {
      set({
        queueError: error instanceof Error ? error.message : "No se pudo armar la cola por BPM.",
      });
    } finally {
      set({ queueBuilding: false });
    }
  },
}));

/**
 * Agrega el mejor match a la cola REAL de Spotify — y sólo eso. A propósito
 * no toca play/pause/transferencia de device: si no se puede encolar (sin
 * device activo, el endpoint de cola falla), se reporta como error visible
 * en vez de tocar el playback del usuario de cualquier otra forma.
 */
async function enqueueBpmMatch(
  accessToken: string,
  top: QueueTrack,
  set: (partial: Partial<SpotifyState>) => void,
): Promise<void> {
  let devices;
  try {
    devices = await getAvailableDevices(accessToken);
  } catch (error) {
    set({ queueError: describePlaybackError(error) });
    return;
  }

  const activeDevice = devices.find((device) => device.isActive);
  if (!activeDevice) {
    set({
      queueError:
        "No hay ningún dispositivo de Spotify activo — dale play a algo en Spotify para que Physical pueda agregar canciones a tu cola.",
    });
    return;
  }

  try {
    await addToQueue(accessToken, `spotify:track:${top.id}`, activeDevice.id ?? undefined);
    // Se registra ya al encolar (no hasta que refreshNowPlaying lo confirme):
    // si no, mientras Spotify no llega a esa canción, el próximo recálculo de
    // cola podría volver a proponerla/encolarla de nuevo.
    usePlayHistoryStore.getState().recordPlayed(top.id);
    set({ lastAutoQueuedTrack: top, queueError: null });
  } catch (error) {
    set({ queueError: describePlaybackError(error) });
  }
}

function describePlaybackError(error: unknown): string {
  if (error instanceof SpotifyApiError && error.status === 401) {
    return "Tu sesión de Spotify no tiene permiso para controlar el playback — cierra sesión y vuelve a entrar para actualizar los permisos.";
  }
  if (error instanceof SpotifyApiError && error.status === 403) {
    return "Spotify rechazó el control de playback — revisa que la cuenta conectada sea Premium.";
  }
  return error instanceof Error ? error.message : "No se pudo mover el playback de Spotify.";
}
