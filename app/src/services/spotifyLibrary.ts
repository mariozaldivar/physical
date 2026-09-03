import { getDb } from "./db";
import { spotifyGet } from "./spotifyApi";

const API_BASE = "https://api.spotify.com/v1";

interface SpotifyPaging<T> {
  // Spotify puede mandar `null` en items individuales (documentado para tracks:
  // "a track object may be null... if a track is no longer available" — se
  // asume el mismo riesgo para cualquier paginado, no sólo tracks).
  items: (T | null)[];
  next: string | null;
  total?: number;
}

interface SpotifyImage {
  url: string;
}

interface SpotifyPlaylistObject {
  id: string;
  name: string;
  owner: { display_name: string | null };
  images: SpotifyImage[] | null;
  // Verificado contra la API real (2026-09-03): el objeto de playlist ya no
  // trae `tracks: { total }` como documentaba el OpenAPI spec — ahora es
  // `items: { total }` (mismo rename que /playlists/{id}/tracks -> /items,
  // ver CLAUDE.md). Sin este fix `trackCount` quedaba siempre en 0.
  items: { total: number };
}

interface SpotifyTrackObject {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { name: string; images: SpotifyImage[] } | null;
  duration_ms: number;
}

interface SpotifySavedTrackObject {
  added_at: string;
  track: SpotifyTrackObject;
}

interface SpotifyPlaylistTrackObject {
  track: SpotifyTrackObject | null;
}

export interface LibraryPlaylist {
  id: string;
  name: string;
  ownerName: string | null;
  imageUrl: string | null;
  trackCount: number;
  /** Si esta playlist alimenta el cross-referencing por BPM — ver PlaylistSelectionScreen. */
  selectedForBpm: boolean;
}

export interface LibraryTrack {
  id: string;
  name: string;
  artists: string;
  albumName: string | null;
  imageUrl: string | null;
  durationMs: number;
  addedAt?: string;
}

/** Spotify manda `next` como URL absoluta; spotifyGet espera un path relativo a /v1. */
function nextPath(next: string | null): string | null {
  if (!next) return null;
  return next.startsWith(API_BASE) ? next.slice(API_BASE.length) : next;
}

// Con limit=50, esto cubre hasta 25,000 items — de sobra para cualquier librería
// real. Es una red de seguridad para que un `next` que nunca termine en `null`
// (por lo que sea: una respuesta inesperada de Spotify, un bug futuro en
// `nextPath`) cuelgue `syncLibrary()` para siempre en vez de fallar con un
// error visible — ver PlaylistSelectionScreen, que ahora sí muestra `libraryError`.
const MAX_PAGES = 500;

async function fetchAllPages<Raw, Item>(
  firstPath: string,
  accessToken: string,
  map: (raw: Raw) => Item | null,
): Promise<Item[]> {
  const results: Item[] = [];
  let path: string | null = firstPath;
  let pageCount = 0;
  while (path) {
    if (++pageCount > MAX_PAGES) {
      throw new Error(`Se alcanzó el límite de ${MAX_PAGES} páginas paginando ${firstPath} — algo no está bien.`);
    }
    const page = await spotifyGet<SpotifyPaging<Raw>>(path, accessToken);
    // Spotify puede mandar entradas `null` en `items` (ej. una canción ya no
    // disponible) — un solo item raro no debe tirar la sincronización completa.
    for (const raw of page.items) {
      if (raw === null) continue;
      const item = map(raw);
      if (item !== null) results.push(item);
    }
    path = nextPath(page.next);
  }
  return results;
}

function mapTrack(track: SpotifyTrackObject): LibraryTrack {
  return {
    id: track.id,
    name: track.name,
    artists: track.artists.map((artist) => artist.name).join(", "),
    albumName: track.album?.name ?? null,
    imageUrl: track.album?.images?.[0]?.url ?? null,
    durationMs: track.duration_ms,
  };
}

interface RawPlaylist {
  id: string;
  name: string;
  ownerName: string | null;
  imageUrl: string | null;
  trackCount: number;
}

/**
 * Trae todas las playlists del usuario (dueñas y seguidas) y las cachea localmente.
 * No toca `selected_for_bpm`: es estado local del usuario en esta app, no algo que
 * venga de Spotify, así que un re-sync nunca debe pisar lo que ya haya elegido en
 * PlaylistSelectionScreen (por eso el UPDATE del upsert no incluye esa columna).
 */
export async function syncPlaylists(accessToken: string): Promise<LibraryPlaylist[]> {
  const playlists = await fetchAllPages<SpotifyPlaylistObject, RawPlaylist>(
    "/me/playlists?limit=50",
    accessToken,
    (playlist) => ({
      id: playlist.id,
      name: playlist.name,
      ownerName: playlist.owner?.display_name ?? null,
      imageUrl: playlist.images?.[0]?.url ?? null,
      trackCount: playlist.items?.total ?? 0,
    }),
  );

  const db = await getDb();
  const now = Date.now();
  for (const playlist of playlists) {
    await db.runAsync(
      `INSERT INTO playlists (id, name, owner_name, image_url, track_count, synced_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name, owner_name = excluded.owner_name, image_url = excluded.image_url,
         track_count = excluded.track_count, synced_at = excluded.synced_at`,
      [playlist.id, playlist.name, playlist.ownerName, playlist.imageUrl, playlist.trackCount, now],
    );
  }
  // Re-lee del cache (en vez de devolver `playlists` tal cual) para que el resultado
  // incluya `selected_for_bpm`, que no viene de Spotify.
  return getCachedPlaylists();
}

/** Trae todo "Liked Songs" del usuario y lo cachea localmente. */
export async function syncLikedSongs(accessToken: string): Promise<LibraryTrack[]> {
  const saved = await fetchAllPages<SpotifySavedTrackObject, LibraryTrack>(
    "/me/tracks?limit=50",
    accessToken,
    (item) => ({ ...mapTrack(item.track), addedAt: item.added_at }),
  );

  const db = await getDb();
  const now = Date.now();
  for (const track of saved) {
    await db.runAsync(
      `INSERT INTO liked_tracks (id, name, artists, album_name, image_url, duration_ms, added_at, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name, artists = excluded.artists, album_name = excluded.album_name,
         image_url = excluded.image_url, duration_ms = excluded.duration_ms,
         added_at = excluded.added_at, synced_at = excluded.synced_at`,
      [track.id, track.name, track.artists, track.albumName, track.imageUrl, track.durationMs, track.addedAt ?? null, now],
    );
  }
  return saved;
}

/**
 * Trae las canciones de una playlist bajo demanda (no se hace eager-fetch de
 * todas las playlists del usuario — ver discusión de rate limits en el informe).
 */
export async function getPlaylistItems(accessToken: string, playlistId: string): Promise<LibraryTrack[]> {
  const rawItems = await fetchAllPages<SpotifyPlaylistTrackObject, LibraryTrack | null>(
    `/playlists/${playlistId}/items?limit=50&fields=items(track(id,name,artists,album,duration_ms)),next`,
    accessToken,
    (item) => (item.track ? mapTrack(item.track) : null),
  );
  const items = rawItems.filter((track): track is LibraryTrack => track !== null);

  const db = await getDb();
  const now = Date.now();
  for (const [index, track] of items.entries()) {
    await db.runAsync(
      `INSERT INTO playlist_tracks (playlist_id, track_id, position, name, artists, album_name, image_url, duration_ms, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(playlist_id, track_id) DO UPDATE SET
         position = excluded.position, name = excluded.name, artists = excluded.artists,
         album_name = excluded.album_name, image_url = excluded.image_url,
         duration_ms = excluded.duration_ms, synced_at = excluded.synced_at`,
      [playlistId, track.id, index, track.name, track.artists, track.albumName, track.imageUrl, track.durationMs, now],
    );
  }
  return items;
}

interface PlaylistRow {
  id: string;
  name: string;
  owner_name: string | null;
  image_url: string | null;
  track_count: number;
  selected_for_bpm: number;
}

export async function getCachedPlaylists(): Promise<LibraryPlaylist[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PlaylistRow>(
    "SELECT id, name, owner_name, image_url, track_count, selected_for_bpm FROM playlists ORDER BY name COLLATE NOCASE",
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    ownerName: row.owner_name,
    imageUrl: row.image_url,
    trackCount: row.track_count,
    selectedForBpm: row.selected_for_bpm === 1,
  }));
}

/** Marca/desmarca una playlist como fuente de canciones para el cross-referencing por BPM. */
export async function setPlaylistSelectedForBpm(playlistId: string, selected: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE playlists SET selected_for_bpm = ? WHERE id = ?", [selected ? 1 : 0, playlistId]);
}

interface LikedTrackRow {
  id: string;
  name: string;
  artists: string;
  album_name: string | null;
  image_url: string | null;
  duration_ms: number;
  added_at: string;
}

export async function getCachedLikedSongs(): Promise<LibraryTrack[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<LikedTrackRow>(
    "SELECT id, name, artists, album_name, image_url, duration_ms, added_at FROM liked_tracks ORDER BY added_at DESC",
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    artists: row.artists,
    albumName: row.album_name,
    imageUrl: row.image_url,
    durationMs: row.duration_ms,
    addedAt: row.added_at,
  }));
}

interface PlaylistTrackRow {
  track_id: string;
  name: string;
  artists: string;
  album_name: string | null;
  image_url: string | null;
  duration_ms: number;
}

/**
 * Lectura pura de cache (sin red) de las canciones de las playlists marcadas
 * `selected_for_bpm` — la fuente de candidatos del cross-referencing real por
 * BPM (ver services/bpmQueue.ts). Sólo trae algo una vez que `getPlaylistItems`
 * se haya llamado al menos una vez por esa playlist — eso pasa automáticamente
 * al seleccionarla en PlaylistSelectionScreen (ver spotifyStore.togglePlaylistSelection).
 */
export async function getCachedTracksForSelectedPlaylists(): Promise<LibraryTrack[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PlaylistTrackRow>(
    `SELECT DISTINCT pt.track_id, pt.name, pt.artists, pt.album_name, pt.image_url, pt.duration_ms
     FROM playlist_tracks pt
     JOIN playlists p ON p.id = pt.playlist_id
     WHERE p.selected_for_bpm = 1`,
  );
  return rows.map((row) => ({
    id: row.track_id,
    name: row.name,
    artists: row.artists,
    albumName: row.album_name,
    imageUrl: row.image_url,
    durationMs: row.duration_ms,
  }));
}
