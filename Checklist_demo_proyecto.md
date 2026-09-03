# Checklist — Physical lista para demo

Estado al 2026-09-03, basado en el código actual de `app/` y los tres documentos de planeación. Pensado para el U-Challenge: no es una lista de "producto terminado", es lo mínimo para poder pararse frente al jurado y que funcione.

## 0. Decisión previa (afecta todo lo demás)

- [ ] **Elegir qué se va a mostrar en vivo**: ya existe un flujo 100% simulado y funcional (banda BLE simulada + BPM simulado + cola armada por match de BPM, ver sección 4) que corre sin hardware. Si el demo va a incluir la banda física real, hay trabajo pendiente grande (sección 3) que no existe todavía ni en código. Recomendación: preparar el flujo simulado como **plan B garantizado** incluso si se apunta a hardware real — el Bluetooth en vivo frente a un jurado es un punto de falla clásico.

## 1. Cuenta y credenciales de Spotify (bloqueante en cualquier escenario)

- [ ] Confirmar que la app está creada en el [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) (Development mode alcanza — tope ~25 usuarios agregados a mano, suficiente para una demo).
- [ ] Llenar `app/.env` con `EXPO_PUBLIC_SPOTIFY_CLIENT_ID` real — **hoy está vacío**, el login nunca se ha probado de punta a punta, sólo se validó que el código compila.
- [ ] Implementar el redirect URI nativo con custom URL scheme (`physical://...`): agregar `"scheme"` en `app.json` y actualizar `getRedirectUri()` en `spotifyAuth.ts` para nativo. Ya está verificado que Spotify lo permite (`Stack_tecnico_proyecto.md` §3, contra el blog oficial de Spotify), pero **sólo se documentó, nunca se implementó en código** — hoy `getRedirectUri()` sigue esperando una variable `EXPO_PUBLIC_SPOTIFY_REDIRECT_URI` HTTPS que no existe.
- [ ] Probar login real al menos una vez en un dispositivo o simulador.
- [ ] Confirmar que la cuenta de Spotify que se use en la demo es **Premium** — `spotifyPlaybackControl.ts` (play/pause/skip/queue) requiere Premium en todos sus endpoints, documentado así por Spotify.

## 2. Build nativo (bloqueante para BLE y para probar en dispositivo real)

- [ ] No existe `eas.json` — nunca se corrió `eas build`. Configurar un profile `development` y generar un Expo Development Build (Expo Go no sirve, no soporta BLE — ver `Stack_tecnico_proyecto.md` §3).
- [ ] Probar la app en un dispositivo físico o simulador real. Hasta ahora sólo se validó que el bundle de Metro compila (`platform=ios`/`android`), nunca se vio renderizada.
- [ ] Configurar permisos de Bluetooth (y ubicación en Android, requisito de BLE) en `app.json` — no están declarados todavía.

## 3. Banda física (sólo si el demo va a usar hardware real — ver punto 0)

- [ ] **Firmware del ESP-32: no existe ni una línea de código.** No hay carpeta `firmware/`, ni proyecto de PlatformIO. `Stack_tecnico_proyecto.md` §2 documenta la decisión técnica (C++/PlatformIO, Heart Rate Service BLE 0x180D) pero es sólo la planeación.
- [ ] Exponer el Heart Rate Service estándar BLE (UUID `0x180D`) desde el firmware — es lo que permite que `react-native-ble-plx` lo lea sin protocolo custom.
- [ ] Conseguir/armar el hardware físico: ESP-32 + sensor BPM (MAX30102/30105) + batería + banda. Presupuesto ya estimado en `Planeacion_proyecto.md` (~$320 en componentes de prototipo).
- [ ] Instalar `react-native-ble-plx` (a propósito no está instalado todavía — ver el comentario en `bleScanner.ts`) y reemplazar el scanner simulado por uno real. `bleScanner.ts` ya expone la misma forma de datos (`id`, `name`, `rssi`) que tendría el real, para que sea el único archivo a reemplazar.
- [ ] Probar el handshake GATT real banda ↔ teléfono, con la banda física encendida y cerca.

## 4. Cross-referencing de BPM

- [x] ReccoBeats integrado y cacheado en SQLite local (`track_audio_features`) — funciona hoy para el track que está sonando en vivo.
- [x] Flujo simulado end-to-end (sin Spotify): banda simulada → BPM → cola armada por match de BPM contra un pool de tracks de muestra (`mockPlayback.ts`).
- [x] Selección de playlists conectada a la cola real (`services/bpmQueue.ts`): candidatos = Liked Songs + canciones de las playlists marcadas en `PlaylistSelectionScreen`, BPM real vía ReccoBeats, cola armada y visible en `NextUpQueue` cuando hay sesión de Spotify. Se recalcula cuando el BPM leído se mueve lo suficiente (`spotifyStore.refreshQueueForBpm`), no en cada tick.
- [ ] Enriquecer `liked_tracks`/`playlist_tracks` con audio features reales de forma proactiva — hoy se resuelven bajo demanda (cache-first) cuando hacen falta para el now-playing o para armar la cola, no hay un enriquecimiento en bloque previo.
- [ ] Registrar cuenta y API key de GetSongBPM (fuente fallback) — ver `TODO_apis_bpm.md`.
- [ ] Descargar el dataset de Kaggle como safety net offline — ver `TODO_apis_bpm.md`.
- [ ] Medir el hit-rate real de ReccoBeats contra una librería real de "Liked Songs" — nota de cobertura pendiente de validar (`Stack_tecnico_proyecto.md` §7).

## 5. Automatización BPM → playback (el corazón del pitch)

- [x] Encolar automáticamente el mejor match a la cola real de Spotify cuando hay un dispositivo activo (`spotifyStore.refreshQueueForBpm` → `enqueueBpmMatch`), con confirmación visible en `HomeScreen`. **Decisión (2026-09-03): sólo encola, nunca toca play/pause/transferencia de device** — se probó un fallback que forzaba la reproducción cuando encolar no era posible, y se descartó a propósito por invasivo. Si no hay device activo, se reporta como error visible (`queueError`) en vez de tocar el playback de cualquier otra forma.
- [ ] **No hace skip automático** cuando el cambio de BPM es drástico (descrito en `Planeacion_proyecto.md`) — sigue sin construirse, y con la decisión de arriba (nunca tocar playback fuera de encolar) probablemente merece su propia conversación de producto antes de implementarlo.
- [x] Errores de playback ahora visibles en `HomeScreen` (`queueError`) en vez de tragados en silencio — incluye un mensaje específico para "tu sesión no tiene permiso" (401) que apunta al botón nuevo de cerrar sesión en `PlaylistSelectionScreen`.
- [x] Helpers de playback/cola ya construidos (`spotifyPlaybackControl.ts`: play/pause/next/previous/seek/queue/transferencia de device) — sólo `addToQueue`/`getAvailableDevices` están en uso desde el store; `usePlaybackControl` (el hook de React) y el resto de acciones (play/pause/skip/seek/transfer) siguen sin conectarse a ninguna UI.
- [x] Manejado el caso "no hay dispositivo Spotify activo": se reporta como error visible, sin tocar el playback.

## 6. Bugs conocidos (resueltos)

- [x] ~~`expo-sqlite` no bundlea para web~~ — faltaba `metro.config.js` con `wasm` en `resolver.assetExts` (fix oficial de Expo). Sin esto, **toda la app** fallaba al buildear en web, no sólo las pantallas con DB, porque `db.ts` se importa transitivamente desde el entry point. Ya resuelto y verificado (bundle web: HTTP 500 → HTTP 200).
- [x] ~~`/me/playlists` nunca traía nada~~ — no era un bug de red ni de credenciales (verificado con un fetch real: 200, 88 playlists). La causa era el bug de arriba (metro.config.js). De paso se corrigió que Spotify renombró `tracks` → `items` en el objeto de playlist, lo que dejaba `trackCount` siempre en 0.

## 7. Pulido de producto (no bloqueante, pero se nota frente al jurado)

- [ ] Confirmar que los errores de Spotify (429/401/403) se ven en pantalla y no sólo en el estado interno — `libraryError`/`error` ya existen en los stores, revisar que estén conectados a algo visible en cada pantalla.
- [ ] Loading state para sync de bibliotecas grandes — con ~3000 Liked Songs son ~60 requests seguidos (punto abierto en `Informe_retrieval_datos.md`), sin loading visible se puede sentir "colgada".
- [ ] Accesibilidad básica: `accessibilityLabel`/`accessibilityRole` sólo están en `SpotifyLoginButton` por ahora, el resto de botones no los tiene.
- [ ] Confirmar que ícono y splash (`assets/*.png`, ya existen) se ven bien en un dispositivo real, no sólo en el simulador.

## 8. Testing

- [ ] No hay ningún framework de testing instalado (ni Jest ni Detox, aunque están recomendados en `Stack_tecnico_proyecto.md` §3). Mínimo viable: seguir corriendo `npx tsc --noEmit` antes de cada sesión de desarrollo (ya es la práctica hasta ahora).
- [ ] Probar el flujo completo, de punta a punta, en un dispositivo real — **nunca se ha hecho**, todo lo verificado hasta ahora fue a nivel de compilación (TypeScript + bundle de Metro), no de UI renderizada.

## 9. Pitch / material de feria

- [x] Respaldo científico verificado y con fuentes reales (`Investigacion_y_pitch_proyecto.md`) — ya corregido para no atribuir nada a la OMS.
- [ ] Armar la presentación — `Planeacion_proyecto.md` todavía dice literalmente "Falta armar la presentación".
- [ ] Preparar explícitamente el plan B: si el Bluetooth falla en vivo (el escenario más probable de falla frente al jurado), caer al flujo 100% simulado (punto 0) — hoy ya funciona y se puede mostrar sin ningún hardware.
