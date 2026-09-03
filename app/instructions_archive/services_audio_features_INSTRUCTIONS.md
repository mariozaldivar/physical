(Este es un archivo de instrucciones, al terminar de implementarlas debes archivarlo)

Implementa la utilización de las APIs que se utilizarán para cross-referencing que habíamos discutido. Actualmente no se cuenta con las credenciales de toda la estructura que se había planteado, así que por el momento solo implementa ReccoBeats. Haz que los valores sobre el mood, bpm, etc obtenidos de la API también se almacenen en la base de datos local junto con cada pista, de manera que localmente tengamos acceso a la información obtenida de las canciones sin tener que re-fetchear datos.

Una vez implementado este sistema, haz que el BPM de las canciones se pueda ver en las tarjetas de estas.

---

**Estado (archivado 2026-09-03):** hecho, solo ReccoBeats (como pedía la instrucción — GetSongBPM y el dataset de Kaggle siguen pendientes de credenciales, ver `TODO_apis_bpm.md`).

- `src/services/reccobeats.ts` — cliente de la API pública de ReccoBeats (sin cuenta ni key). `GET /v1/audio-features?ids=<spotify_ids>` acepta Spotify track IDs directo, en lotes de 40. Verificado contra la API real (no solo contra su documentación, que está incompleta/ambigua): cada resultado trae su propio `id` interno de ReccoBeats, así que el match con el Spotify track ID pedido se hace parseando el campo `href` (`https://open.spotify.com/track/{id}`), no por índice ni por el campo `id`. Maneja 429 con `Retry-After`, mismo patrón que `spotifyApi.ts`. Tracks sin cobertura en ReccoBeats simplemente no aparecen en el resultado, sin error (ver nota de cobertura en `Stack_tecnico_proyecto.md` §7).
- `src/services/db.ts` — nueva tabla `track_audio_features` (spotify_track_id, source, tempo, valence, energy, danceability, acousticness, instrumentalness, liveness, loudness, speechiness, fetched_at). Es el "mood, bpm, etc" que pedía la instrucción: se guarda el audio-features completo por track, no solo el tempo.
- `src/services/audioFeatures.ts` — orquestación cache-first: `getAudioFeaturesForTracks(ids)` lee primero de SQLite y sólo pega a ReccoBeats por los IDs que falten, con upsert de vuelta a la tabla. Mismo patrón lazy que `getPlaylistItems` en `spotifyLibrary.ts` — nunca re-fetchea un track que ya se consultó.
- BPM visible en tarjeta: `src/store/spotifyStore.ts` (`refreshNowPlaying`) llama a `getAudioFeaturesForTracks` para el track que está sonando y completa `nowPlaying.track.bpm` sin bloquear el poll de now-playing (corre en paralelo; si no hay cobertura o falla la red, el track se queda sin BPM y `NowPlayingCard` ya maneja ese caso con el badge "BPM no disponible"). `NowPlayingCard` no necesitó cambios — ya soportaba `track.bpm` opcional.

Pendiente para una fase futura (fuera de esta instrucción): enriquecer también `liked_tracks`/`playlist_tracks` con audio features (hoy sólo se resuelve para el track en reproducción), y el cross-referencing real de `NextUpQueue` contra las playlists seleccionadas en `PlaylistSelectionScreen` (ver `components_playlist_selection_INSTRUCTIONS.md`) — sigue siendo mock.
