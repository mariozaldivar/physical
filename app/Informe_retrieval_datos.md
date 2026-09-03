# Informe — Data retrieval y storage de la librería de Spotify

Estado al 2026-09-02. Cubre lo que pedía `app/src/data/INSTRUCTIONS.md` (archivado).

## 1. Respuesta sobre recomendaciones del algoritmo

**No se puede usar `GET /recommendations` para esta app.** Confirmado contra el changelog oficial de Spotify (27 nov 2024): el endpoint quedó restringido para toda app nueva o en modo desarrollo sin "Extended Quota Mode" aprobado — junto con Related Artists, Audio Features, Audio Analysis, Featured Playlists y las playlists editoriales de Spotify. La app "Physical" está en **Development mode** (se ve en el dashboard), así que cae directo en la restricción.

Por eso **no se construyó** el sistema de clasificación de recomendaciones por BPM que pedía la instrucción condicionalmente ("en caso de que sí exista"). No hay nada que clasificar: la fuente tendría que ser, como ya documentaba `Stack_tecnico_proyecto.md` §5/§7, ReccoBeats/GetSongBPM/dataset de Kaggle — y ninguna de esas da "recomendaciones", solo BPM de tracks que tú ya tengas identificados. Si en algún momento solicitan y les aprueban Extended Quota Mode, esto se puede revisar.

## 2. Qué se construyó

```
Spotify Web API                    SQLite local (expo-sqlite)
┌──────────────┐   fetch + upsert   ┌───────────────────┐
│ /me/playlists│ ─────────────────▶ │ playlists          │
│ /me/tracks   │ ─────────────────▶ │ liked_tracks        │
│ /playlists/  │  (bajo demanda,    │ playlist_tracks     │
│ {id}/items   │   por playlist)    │ (playlist_id, track)│
└──────────────┘                    └───────────────────┘
       │ poll 5s
       ▼
/me/player/currently-playing → NowPlayingCard (en vivo, sin pasar por cache)
```

- `src/services/spotifyApi.ts` — cliente HTTP compartido (antes vivía duplicado dentro de `spotifyAuth.ts`). Maneja 429 con `Retry-After` (un solo reintento) y errores documentados del OpenAPI spec, igual que el resto de la integración con Spotify.
- `src/services/spotifyLibrary.ts`:
  - `syncPlaylists()` — pagina `GET /me/playlists` completo (50 por página), upsert a `playlists`.
  - `syncLikedSongs()` — pagina `GET /me/tracks` completo, upsert a `liked_tracks`.
  - `getPlaylistItems(playlistId)` — **lazy**, solo cuando se pide una playlist puntual, vía `GET /playlists/{id}/items` (no `/tracks`, que está deprecado). Upsert a `playlist_tracks`.
  - `getCachedPlaylists()` / `getCachedLikedSongs()` — lectura pura del cache, sin red.
- `src/services/spotifyPlayback.ts` — `getCurrentlyPlaying()` vía `GET /me/player/currently-playing`. Es la única pieza que **no** pasa por SQLite: es un display en vivo, se pidió explícitamente que funcionara así.
- `src/services/db.ts` — abre `physical.db` con `expo-sqlite` (funciona en nativo y web — web usa el build WASM de la librería, no lo probé todavía en un navegador real, ver punto abierto abajo) y crea el schema si no existe.
- `src/store/spotifyStore.ts` (Zustand) — sesión real de Spotify, estado de sync, `nowPlaying`. `HomeScreen` lo consume: al montar carga cache local al toque, dispara sync fresco si hay sesión, y hace poll de now-playing cada 5s.
- Scopes ampliados en `spotifyAuth.ts`: se agregaron `playlist-read-private`, `user-library-read`, `user-read-currently-playing` (mínimos necesarios para esto, nada de scopes de escritura/control de playback todavía).

`NowPlayingCard` ahora distingue "Reproduciendo desde Spotify" (dato real) de "Vista previa · datos de muestra" (el mock que ya existía) — y el badge de BPM se oculta cuando no hay dato (los tracks reales no traen BPM, ver más abajo).

## 3. Por qué el BPM real sigue sin aparecer en pantalla

`Track.bpm` es opcional ahora (`src/types/music.ts`). Los tracks que vienen de Spotify (now-playing, liked songs, playlist items) **nunca** traen BPM — sigue sin existir una fuente pública confiable de tempo por track (audio-features deprecado, igual que recomendaciones). El cross-referencing BPM↔canción de `NextUpQueue` sigue siendo 100% mock, sin cambios. Conectar esto de verdad requiere resolver primero el TODO de `TODO_apis_bpm.md` (cuentas de GetSongBPM/Kaggle).

## 4. Puntos abiertos para discutir

1. **Staleness / TTL** — hoy `syncLibrary()` siempre hace fetch completo, no hay noción de "cache fresco vs viejo". Para una librería de miles de likes esto puede ser lento y no hace falta cada vez: Spotify da `snapshot_id` por playlist, que cambia solo si la playlist se modificó — se podría usar para saltarse el refetch de una playlist sin cambios.
2. **Costo de la sync completa en librerías grandes** — `syncLikedSongs()` pagina todo de una sentada (50 por página). Con una librería de, digamos, 3000 likes son 60 requests seguidos. El único throttling que hay es el retry de 429; no hay límite de páginas ni sync incremental por `added_at`. Vale la pena decidir un tope o una estrategia incremental antes de probarlo con una cuenta real grande.
3. **Dónde vive esto a futuro** — ~~todo corre client-side (device → Spotify directo)... Pero el cross-referencing con la base de BPM de canciones sí necesita el backend (Postgres) que todavía no existe~~. **Actualización 2026-09-02: ya no aplica.** Se replaneó el stack para eliminar el backend por completo (ver `Stack_tecnico_proyecto.md` §4 y §7) — el cross-referencing de BPM ahora vive en una tabla `track_bpm` en el mismo SQLite local (`db.ts`), consultando ReccoBeats/GetSongBPM directo desde el device. Esto desbloquea el punto que quedó pausado en `app/instructions_archive/services_INSTRUCTIONS.md`.
4. **expo-sqlite en web** — usa un backend distinto (WASM) al nativo (SQLite real). El código es el mismo API async en ambos, pero no verifiqué en un navegador real que el WASM build cargue bien en este proyecto — falta esa prueba antes de confiar en el cache en la demo web.
5. **Multi-dispositivo** — si el usuario edita su librería de Spotify desde el celular mientras prueba la app en web (o viceversa), no hay invalidación: el cache muestra lo último sincronizado en *esa* sesión de la app, no lo último real de Spotify, hasta el próximo `syncLibrary()`.

## 5. Qué no se tocó

No hay ninguna pantalla que liste playlists o liked songs todavía — la instrucción pedía preparar el *sistema* de retrieval, no una UI para navegarlo. Los datos ya están cacheados y listos para una screen futura (`getCachedPlaylists()` / `getCachedLikedSongs()`).
