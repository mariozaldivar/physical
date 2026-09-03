(Este es un archivo de instrucciones, al terminar de implementarlas debes archivarlo)

Implementa todos los helpers y lógica detrás de la modificación del playback del usuario. Si bien aún no se cuenta con el sistema de bpm para dictar las recomendaciones, prepara todos los métodos y helpers necesarios que hablen con la API para poder controlar tanto el playback como la queue.

---

**Estado (archivado 2026-09-03):** hecho. Sólo la plomería — nada dispara estas acciones automáticamente todavía, como pedía la instrucción ("aún no se cuenta con el sistema de bpm").

- **Scopes nuevos** en `src/services/spotifyAuth.ts`: `user-modify-playback-state` (control de playback/cola) y `user-read-playback-state` (listar devices). Verificados uno por uno contra la documentación oficial del Web API, no adivinados (regla de CLAUDE.md). Un usuario con sesión guardada de antes de este cambio va a necesitar volver a iniciar sesión para que Spotify le pida estos scopes nuevos.
- `src/services/spotifyApi.ts` — nuevo `spotifyMutate(method, path, token, body?)` genérico para PUT/POST (todos los endpoints de control devuelven 204 sin cuerpo; `request()` ya sabía manejar eso, sólo hacía falta poder mandar un método distinto de GET y, opcionalmente, un body).
- `src/services/spotifyPlaybackControl.ts` — cliente puro: `getAvailableDevices`, `transferPlayback`, `resumePlayback` (con `contextUri`/`uris`/`offset`/`positionMs` opcionales), `pausePlayback`, `skipToNext`, `skipToPrevious`, `seekToPosition`, `addToQueue`, `getQueue`. `getQueue()` en particular no necesitó el scope nuevo — corre con `user-read-currently-playing`, que ya existía.
- `src/hooks/usePlaybackControl.ts` — wrapper de React: toma el access token de `spotifyStore` para que quien lo use no tenga que pasarlo a mano, y expone `loading`/`error` + una función por acción, listas para conectarse a botones de UI o, más adelante, a la lógica de BPM que decida cuándo hacer skip o qué encolar.
- No incluye `shuffle`/`repeat`: no aparecen en el flujo descrito en `Planeacion_proyecto.md` (que sólo habla de encolar o skippear según el cambio de BPM), así que se dejaron fuera para no meter superficie de API sin un caso de uso concreto todavía. Se pueden agregar cuando haga falta — mismo patrón que el resto del archivo.

Pendiente para una fase futura (fuera de esta instrucción): el propio sistema de BPM que decida cuándo llamar a `next()`/`addToQueue()`, y una UI que use `usePlaybackControl` (hoy no está conectado a ninguna pantalla).
