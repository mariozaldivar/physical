(Este es un archivo de instrucciones, al terminar de implementar lo que se encuentra en él, archívalo).

Empieza a trabajar en el flujo de data-retrieval del usuario. Si bien aún no se implementará el mecanismo total de cambiar el playback según el BPM, prepara el sistema de retrieval de las playlists y gusto del usuario. También, infórmame si existe algún endpoint que se pueda usar para obtener recomendaciones del algoritmo de spotify para el usuario. En caso de que sí, también diseña un sistema para obtener recomendaciones del algoritmo (y clasificarlas internamente por BPM).

Haz el sistema de retrieval y almacenamiento, posteriormente escríbeme un informe en formato .md de cómo se encuentra y discutiremos estrategias de caching, procesamiento, etc.

Adicionalmente, haz que el playback funcione en vivo, mostrando lo que el usuario está escuchando (como este display es separado, esta funcionalidad ya se puede implementar completa).

---

**Estado (archivado 2026-09-02):** hecho, con un límite real documentado. Ver `app/Informe_retrieval_datos.md` para el detalle completo (arquitectura, schema de SQLite, puntos abiertos de caching). Resumen:

- Recomendaciones del algoritmo: **no hay endpoint disponible** para esta app (Development mode) — Spotify restringió `/recommendations` en el mismo anuncio de nov. 2024 que restringió `audio-features`. No se construyó el sistema de clasificación por BPM porque no hay nada que clasificar.
- Retrieval + storage: `spotifyLibrary.ts` (playlists y liked songs, paginado completo) + `db.ts` (cache en SQLite vía `expo-sqlite`). Playlists de forma eager, canciones por playlist de forma lazy (bajo demanda) para no golpear rate limits.
- Playback en vivo: `spotifyPlayback.ts` + poll cada 5s en `HomeScreen`, ya integrado a `NowPlayingCard` (distingue "en vivo" de la vista previa mock existente).
