import { create } from "zustand";
import { getAudioFeaturesForTracks } from "../services/audioFeatures";
import { buildQueueForBpm, DEFAULT_QUEUE_BATCH_SIZE } from "../services/bpmQueue";
import { clearSession, type SpotifySession } from "../services/spotifyAuth";
import { getCurrentlyPlaying, type LivePlayback } from "../services/spotifyPlayback";
import { addToQueue, getAvailableDevices, getQueue, skipToNext } from "../services/spotifyPlaybackControl";
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

// Cuánto tiene que moverse el BPM leído desde el último cálculo para que
// cuente como "cambio notable" de ritmo — 10-15 BPM (ver INSTRUCTIONS.md).
const BPM_RECOMPUTE_THRESHOLD = 12;

// Cuánto tiempo tiene que mantenerse ese cambio notable (sin volver a estar
// dentro del rango de BPM_RECOMPUTE_THRESHOLD) antes de rearmar la cola de
// verdad — es el "rate limiter" del flujo: sin esto, un salto puntual de BPM
// de un solo tick ya dispara un recálculo y le pega a ReccoBeats/Spotify,
// aunque el ritmo vuelva a lo normal medio segundo después. Con esto, sólo
// cuenta un cambio de ritmo sostenido. No aplica al arranque ni a un
// `force` (ver refreshQueueForBpm) — ahí siempre se recalcula de inmediato.
const BPM_CHANGE_SUSTAIN_MS = 20_000;

// Cada cuánto se poda el modelo local (`contemplatedQueueIds`/`skipQueueIds`)
// contra la cola real de Spotify (`GET /me/player/queue`) — independiente de
// los cambios de BPM, para detectar que el usuario ya sacó/escuchó algo que
// Physical creía pendiente y dejar de rastrearlo. No agrega nada nuevo (ver
// syncQueueModel). Una llamada cada 30s es un costo mínimo de rate limit, y
// no hace nada mientras Physical no haya encolado algo todavía.
const QUEUE_MODEL_SYNC_MS = 30_000;

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
  /** Desde cuándo el BPM está fuera del rango de `lastQueueBpm` sin volver a entrar — null si no hay un cambio en curso (ver BPM_CHANGE_SUSTAIN_MS). */
  pendingBpmChangeSince: number | null;
  /** Lo último que se acaba de agregar a la cola real de Spotify — un batch completo (swap por BPM) o una sola canción (reposición continua, ver topUpBatch) — para mostrar "se agregó/agregaron X canciones". */
  lastAutoQueuedTracks: QueueTrack[];
  /**
   * Modelo local de la cola real de Spotify, identificado por track ID.
   * `contemplatedQueueIds` es el batch vigente que Physical encoló (lo que
   * debería sonar), en orden. `skipQueueIds` es SÓLO lo que Physical mismo
   * encoló en un batch anterior y ya quedó obsoleto — nunca contiene
   * canciones ajenas (autoplay de Spotify, la playlist que el usuario ya
   * traía sonando, algo agregado a mano): eso no se toca, no hay forma de
   * saber si el usuario lo quiere ahí o no. Se actualiza de forma optimista
   * al encolar un batch nuevo (ver enqueueBpmMatches) y se poda contra la
   * cola real vía `syncQueueModel` (ver QUEUE_MODEL_SYNC_MS) — nunca se le
   * agrega nada ahí, sólo se quita lo que ya sonó o el usuario ya sacó.
   */
  contemplatedQueueIds: string[];
  skipQueueIds: string[];

  setSession: (session: SpotifySession | null) => void;
  /** Cierra la sesión de Spotify guardada — necesario para re-loguear y pedir scopes nuevos. */
  signOut: () => Promise<void>;
  /** Lectura instantánea del cache local (offline-first), sin pegarle a la API. */
  loadCachedLibrary: () => Promise<void>;
  /** Fetch completo a Spotify + upsert al cache local (ver informe de datos para estrategia). */
  syncLibrary: () => Promise<void>;
  refreshNowPlaying: () => Promise<void>;
  /**
   * Contrasta `contemplatedQueueIds`/`skipQueueIds` contra la cola real
   * (`GET /me/player/queue`) y los corrige con lo que Spotify reporta de
   * verdad — ver HomeScreen, que la llama en un intervalo propio
   * (QUEUE_MODEL_SYNC_MS) mientras haya sesión. Ante un fallo de red deja el
   * modelo local tal cual (no lo vacía) y reintenta en el próximo tick.
   */
  syncQueueModel: () => Promise<void>;
  /** Optimista: refleja el toggle en memoria de inmediato y lo persiste en SQLite. */
  togglePlaylistSelection: (playlistId: string) => Promise<void>;
  /**
   * Rearma `queue` según el BPM actual (no-op si no se movió lo suficiente
   * desde el último cálculo, salvo que `force` sea true — ver HomeScreen,
   * que fuerza un recálculo apenas termina el primer `syncLibrary()` para no
   * quedarse con una cola vacía si la sesión arrancó antes de que la
   * biblioteca terminara de sincronizar).
   */
  refreshQueueForBpm: (targetBpm: number, excludeTrackId?: string, force?: boolean) => Promise<void>;
  /** Limpia la cola/errores real armados por BPM — llamar junto a `sessionStore.stopSync()`. */
  clearQueue: () => void;
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
  pendingBpmChangeSince: null,
  lastAutoQueuedTracks: [],
  contemplatedQueueIds: [],
  skipQueueIds: [],

  setSession: (session) =>
    set({
      session,
      nowPlaying: session ? get().nowPlaying : null,
      queue: session ? get().queue : [],
      lastQueueBpm: null,
      pendingBpmChangeSince: null,
      lastAutoQueuedTracks: [],
      contemplatedQueueIds: [],
      skipQueueIds: [],
      queueError: null,
    }),

  signOut: async () => {
    await clearSession();
    get().setSession(null);
  },

  loadCachedLibrary: async () => {
    try {
      const [playlists, likedSongs] = await Promise.all([getCachedPlaylists(), getCachedLikedSongs()]);
      set({ playlists, likedSongs });
    } catch (error) {
      // Sin este catch, un cache SQLite corrupto (ver services/db.ts) tira un
      // unhandled rejection en el arranque de HomeScreen: la librería queda
      // vacía sin ninguna señal de qué pasó.
      set({
        libraryError:
          error instanceof Error ? error.message : "No se pudo leer tu biblioteca guardada localmente.",
      });
    }
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
        await reconcileQueueLedger(live.track.id, session.accessToken, get, set);
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

  syncQueueModel: async () => {
    const { session, contemplatedQueueIds, skipQueueIds } = get();
    if (!session) return;
    // Nada que Physical haya encolado todavía (sesión recién arrancada, o
    // usuario escuchando su propia playlist/autoplay sin que hayamos tocado
    // nada) — no hay nada que validar, y sobre todo: no hay que tocar la
    // cola real de nadie sólo por mirarla.
    if (contemplatedQueueIds.length === 0 && skipQueueIds.length === 0) return;

    try {
      const { queue: liveQueue } = await getQueue(session.accessToken);
      const liveIds = new Set(liveQueue.map((track) => track.id));
      // Sólo se PODA contra la cola real (se quita lo que ya sonó o el
      // usuario ya saltó/quitó) — nunca se agrega nada acá. Marcar algo como
      // "a saltar" es responsabilidad exclusiva de enqueueBpmMatches, y sólo
      // para lo que Physical mismo encoló; así una playlist o el autoplay
      // del usuario nunca terminan marcados para saltar.
      set({
        contemplatedQueueIds: contemplatedQueueIds.filter((id) => liveIds.has(id)),
        skipQueueIds: skipQueueIds.filter((id) => liveIds.has(id)),
      });
    } catch {
      // Sin datos confiables de la cola real por ahora: se conserva el
      // último modelo local conocido y se reintenta en el próximo tick.
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

  refreshQueueForBpm: async (targetBpm, excludeTrackId, force = false) => {
    const { session, lastQueueBpm, queueBuilding } = get();
    if (!session || queueBuilding) return;

    // 0 BPM no es un ritmo lento: es "todavía no hay lectura". Pasa siempre al
    // conectar una banda real (la primera notificación tarda ~1s) y de forma
    // permanente si el sensor no responde. Sin esta guarda se armaría una cola
    // "para 0 BPM" —las canciones más lentas del catálogo— y, peor, se
    // escribiría en la cola real de Spotify del usuario a partir de un dato
    // que no existe.
    if (targetBpm <= 0) return;

    if (!force && lastQueueBpm !== null) {
      const diff = Math.abs(targetBpm - lastQueueBpm);
      if (diff < BPM_RECOMPUTE_THRESHOLD) {
        // El ritmo volvió a estar dentro del rango normal: el cambio no era
        // sostenido, se olvida.
        if (get().pendingBpmChangeSince !== null) set({ pendingBpmChangeSince: null });
        return;
      }
      const since = get().pendingBpmChangeSince ?? Date.now();
      if (get().pendingBpmChangeSince === null) set({ pendingBpmChangeSince: since });
      if (Date.now() - since < BPM_CHANGE_SUSTAIN_MS) return;
    }

    set({ pendingBpmChangeSince: null, queueBuilding: true, queueError: null });
    try {
      const queue = await buildQueueForBpm(targetBpm, excludeTrackId);
      set({ queue, lastQueueBpm: targetBpm });

      // El grupo entero (hasta 3) se manda a la cola real de Spotify de una
      // sola vez, reemplazando lo que este cálculo hubiera propuesto antes
      // (`queue` ya se sobre-escribió arriba, no se apila localmente) — y
      // sólo cuando el cambio de BPM fue sostenido (ver guard de arriba), así
      // que esto pasa "una vez por cambio de ritmo real", no en cada tick.
      const recentlyQueued = new Set(usePlayHistoryStore.getState().recentTrackIds);
      const fresh = queue.filter((track) => !recentlyQueued.has(track.id));
      if (fresh.length > 0) {
        await enqueueBpmMatches(session.accessToken, fresh, get, set);
      }
    } catch (error) {
      set({
        queueError: error instanceof Error ? error.message : "No se pudo armar la cola por BPM.",
      });
    } finally {
      set({ queueBuilding: false });
    }
  },

  clearQueue: () =>
    set({
      queue: [],
      lastQueueBpm: null,
      pendingBpmChangeSince: null,
      lastAutoQueuedTracks: [],
      contemplatedQueueIds: [],
      skipQueueIds: [],
      queueError: null,
    }),
}));

// Tope duro de saltos consecutivos en una sola pasada de skipPastStaleTracks —
// nunca debería hacer falta más que un par de batches viejos, así que esto es
// sólo una red de seguridad para no entrar en un loop si el modelo local
// quedó mal sincronizado.
const MAX_AUTO_SKIPS = 10;
// Margen para que Spotify refleje el cambio de canción después de un
// `POST /me/player/next` antes de volver a leer "qué está sonando ahora".
const SKIP_CONFIRM_DELAY_MS = 400;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Se llama cada vez que `refreshNowPlaying` detecta que Spotify empezó a
 * reproducir una canción distinta. Tres casos:
 *  - Es una canción contemplada: sale del batch (y de todo lo anterior a
 *    ella en el batch, si el usuario saltó de largo por encima — ver abajo),
 *    y se repone lo que haga falta con canciones frescas al final
 *    (`topUpBatch`) — así el programa es continuo, no hace falta esperar un
 *    cambio de BPM para tener "qué sigue".
 *  - Es algo marcado "a saltar" (un batch propio ya obsoleto): se saltea
 *    hasta llegar al batch vigente (`skipPastStaleTracks`).
 *  - Ninguna de las dos: contenido ajeno, o el usuario saltó manualmente a
 *    otra cosa — se reconcilia contra la cola real por si alguna contemplada
 *    se perdió en el camino (`reconcileAfterUserSkip`), sin tocar nada que
 *    no sea nuestro.
 */
async function reconcileQueueLedger(
  trackId: string,
  accessToken: string,
  get: () => SpotifyState,
  set: (partial: Partial<SpotifyState>) => void,
): Promise<void> {
  const { contemplatedQueueIds, skipQueueIds, queue } = get();

  const contemplatedIndex = contemplatedQueueIds.indexOf(trackId);
  if (contemplatedIndex !== -1) {
    // Llegamos a una canción contemplada. Si no era la primera del batch, el
    // usuario saltó manualmente por encima de las anteriores (nunca
    // sonaron) — igual salen todas: ya no están por delante en la cola real,
    // así que no hay nada que "saltar" nosotros, sólo reponerlas (abajo).
    // Ya estaban registradas en el historial desde que se encolaron, así
    // que no se van a volver a recomendar.
    set({
      contemplatedQueueIds: contemplatedQueueIds.slice(contemplatedIndex + 1),
      skipQueueIds: [],
      queue: queue.filter((track) => track.id !== trackId),
    });
    await topUpBatch(accessToken, trackId, get, set);
    return;
  }

  if (skipQueueIds.includes(trackId)) {
    await skipPastStaleTracks(accessToken, get, set);
    return;
  }

  await reconcileAfterUserSkip(accessToken, trackId, get, set);
}

/**
 * Caso "ninguna de las dos" de `reconcileQueueLedger`: lo que suena ahora no
 * es ni una contemplada ni algo marcado a saltar. Puede ser contenido
 * totalmente ajeno (el usuario se puso a escuchar su propia playlist) — ahí
 * no hay nada que hacer, nuestro batch sigue esperando en la cola real. Pero
 * también puede ser que el usuario haya saltado manualmente (botón
 * siguiente) una o más de nuestras contempladas para llegar a otra cosa —
 * en ese caso esas canciones ya no están en la cola real de Spotify, y hay
 * que darse cuenta para no seguir contando con ellas y reponer el batch.
 *
 * Se distingue con UNA sola lectura de la cola real (`GET /me/player/queue`,
 * mismo endpoint que `syncQueueModel`, no dispara nada más pesado): lo
 * contemplado que ya no aparece ahí se dio por saltado (no se repite, ya
 * estaba en el historial desde que se encoló) y se repone; lo que sigue
 * presente se deja tal cual, por si el usuario vuelve.
 */
async function reconcileAfterUserSkip(
  accessToken: string,
  excludeTrackId: string,
  get: () => SpotifyState,
  set: (partial: Partial<SpotifyState>) => void,
): Promise<void> {
  const { contemplatedQueueIds, queue } = get();
  if (contemplatedQueueIds.length === 0) return; // no había nada nuestro que perder

  let liveQueue;
  try {
    ({ queue: liveQueue } = await getQueue(accessToken));
  } catch {
    return; // sin datos confiables por ahora: se reintenta en el próximo cambio de track
  }
  const liveIds = new Set(liveQueue.map((track) => track.id));

  const survivors = contemplatedQueueIds.filter((id) => liveIds.has(id));
  if (survivors.length === contemplatedQueueIds.length) return; // el batch sigue intacto en la cola real

  set({
    contemplatedQueueIds: survivors,
    queue: queue.filter((track) => survivors.includes(track.id)),
  });
  await topUpBatch(accessToken, excludeTrackId, get, set);
}

/**
 * Repone el batch hasta `DEFAULT_QUEUE_BATCH_SIZE`, agregando canciones
 * frescas de a una al final (con BPM similar al target vigente,
 * `lastQueueBpm`), tantas como hagan falta — puede ser sólo una (consumo
 * normal) o varias de una vez (el usuario saltó de golpe más de una
 * contemplada, ver `reconcileAfterUserSkip`). Usa `lastQueueBpm` (no un BPM
 * en vivo) para que todo el batch quede centrado en el mismo target hasta el
 * próximo swap completo. Best-effort: cualquier fallo corta el reintento acá
 * (se vuelve a intentar solo en el próximo track consumido), sin ensuciar
 * `queueError` por algo que no bloquea la reproducción actual.
 */
async function topUpBatch(
  accessToken: string,
  excludeTrackId: string,
  get: () => SpotifyState,
  set: (partial: Partial<SpotifyState>) => void,
): Promise<void> {
  const { lastQueueBpm } = get();
  if (lastQueueBpm === null) return; // todavía no hay un target de referencia

  let devices;
  try {
    devices = await getAvailableDevices(accessToken);
  } catch {
    return;
  }
  const activeDevice = devices.find((device) => device.isActive);
  if (!activeDevice) return;

  const added: QueueTrack[] = [];
  while (get().contemplatedQueueIds.length < DEFAULT_QUEUE_BATCH_SIZE) {
    let pick: QueueTrack | undefined;
    try {
      [pick] = await buildQueueForBpm(lastQueueBpm, excludeTrackId, 1);
    } catch {
      break;
    }
    if (!pick) break;

    try {
      await addToQueue(accessToken, `spotify:track:${pick.id}`, activeDevice.id ?? undefined);
    } catch {
      break;
    }
    // Se registra ya al encolar (no hasta que refreshNowPlaying lo confirme)
    // para que, si hace falta más de un pick en esta misma racha, el
    // siguiente `buildQueueForBpm` ya lo vea como "reciente" y no lo repita.
    usePlayHistoryStore.getState().recordPlayed(pick.id);
    added.push(pick);
    set({
      contemplatedQueueIds: [...get().contemplatedQueueIds, pick.id],
      queue: [...get().queue, pick],
    });
  }
  if (added.length > 0) set({ lastAutoQueuedTracks: added });
}

/**
 * Manda `next()` de a uno, confirmando después de cada salto (con un margen
 * de `SKIP_CONFIRM_DELAY_MS`) qué está sonando de verdad, hasta llegar a la
 * primera canción de `contemplatedQueueIds`. Si en algún punto lo que suena
 * no es ni lo contemplado ni algo marcado para saltar, se detiene de
 * inmediato — es contenido ajeno (autoplay, playlist propia del usuario) y
 * seguir saltando de largo se llevaría canciones que el usuario sí quiere
 * escuchar. `MAX_AUTO_SKIPS` es sólo una red de seguridad.
 */
async function skipPastStaleTracks(
  accessToken: string,
  get: () => SpotifyState,
  set: (partial: Partial<SpotifyState>) => void,
): Promise<void> {
  for (let i = 0; i < MAX_AUTO_SKIPS; i++) {
    if (get().contemplatedQueueIds.length === 0) return; // no hay a dónde llegar

    try {
      await skipToNext(accessToken);
    } catch {
      return; // sin device activo u otro fallo: no insistir
    }
    await wait(SKIP_CONFIRM_DELAY_MS);

    let live;
    try {
      live = await getCurrentlyPlaying(accessToken);
    } catch {
      return;
    }
    const currentId = live?.track.id;
    if (!currentId) return;

    if (currentId === get().contemplatedQueueIds[0]) return; // llegamos

    const { skipQueueIds } = get();
    if (!skipQueueIds.includes(currentId)) {
      // Lo que sigue no es nada que Physical haya encolado — no seguir
      // saltando canciones ajenas.
      set({ skipQueueIds: [] });
      return;
    }
    set({ skipQueueIds: skipQueueIds.filter((id) => id !== currentId) });
  }
}

/**
 * Agrega el grupo de matches a la cola REAL de Spotify — y sólo eso. A
 * propósito no toca play/pause/transferencia de device: si no se puede
 * encolar (sin device activo, el endpoint de cola falla), se reporta como
 * error visible en vez de tocar el playback del usuario de cualquier otra
 * forma. Se detiene en el primer fallo (ej. sin device activo) en vez de
 * reintentar el resto del grupo, que fallaría igual.
 */
async function enqueueBpmMatches(
  accessToken: string,
  tracks: QueueTrack[],
  get: () => SpotifyState,
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

  // El batch vigente hasta ahora queda obsoleto apenas se decide encolar uno
  // nuevo — se marca "a saltar" (ver skipPastStaleTracks/reconcileQueueLedger)
  // ANTES de agregar el nuevo, así que si algo falla a mitad del encolado no
  // se pierde el rastro de lo que había antes.
  const { contemplatedQueueIds, skipQueueIds } = get();
  set({ skipQueueIds: [...skipQueueIds, ...contemplatedQueueIds], contemplatedQueueIds: [] });

  const queued: QueueTrack[] = [];
  for (const track of tracks) {
    try {
      await addToQueue(accessToken, `spotify:track:${track.id}`, activeDevice.id ?? undefined);
      // Se registra ya al encolar (no hasta que refreshNowPlaying lo confirme):
      // si no, mientras Spotify no llega a esa canción, el próximo recálculo de
      // cola podría volver a proponerla/encolarla de nuevo.
      usePlayHistoryStore.getState().recordPlayed(track.id);
      queued.push(track);
      // Se va contemplando cada canción apenas se confirma encolada (no al
      // final) — si el resto del batch falla, lo que sí llegó a la cola real
      // ya cuenta como parte de lo contemplado.
      set({ contemplatedQueueIds: [...get().contemplatedQueueIds, track.id] });
    } catch (error) {
      set({ lastAutoQueuedTracks: queued, queueError: describePlaybackError(error) });
      return;
    }
  }
  set({ lastAutoQueuedTracks: queued, queueError: null });
}

function describePlaybackError(error: unknown): string {
  if (error instanceof SpotifyApiError && error.status === 401) {
    return "Tu sesión de Spotify no tiene permiso para controlar el playback — cierra sesión y vuelve a entrar para actualizar los permisos.";
  }
  if (error instanceof SpotifyApiError && error.status === 403) {
    // Verificado (comunidad de devs de Spotify): 403 en endpoints de /me/player
    // casi siempre es "Insufficient client scope" (sesión anterior a que se
    // pidieran user-modify-playback-state/user-read-playback-state — ver
    // spotifyAuth.ts), no sólo cuenta no-Premium. Se muestran ambas causas
    // posibles en vez de asumir una sola y mandar al usuario por el camino
    // equivocado.
    return `Spotify rechazó el control de reproducción (${error.message}) — puede ser que la cuenta no sea Premium, o que tu sesión sea anterior a un permiso nuevo: cierra sesión y vuelve a entrar para renovarlo.`;
  }
  return error instanceof Error ? error.message : "No se pudo mover el playback de Spotify.";
}
