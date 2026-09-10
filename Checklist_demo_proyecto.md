# Checklist — Physical lista para demo

Estado al 2026-09-07, basado en el código actual de `app/` y los tres documentos de planeación. Pensado para el U-Challenge: no es una lista de "producto terminado", es lo mínimo para poder pararse frente al jurado y que funcione.

## 0. Decisión previa (afecta todo lo demás)

- [ ] **Elegir qué se va a mostrar en vivo.** Las dos rutas ya existen en la app: la banda real por BLE (integrada, ver sección 3) y el flujo 100% simulado sin hardware. El plan B ya no requiere recompilar nada — en el modal de conexión hay un botón **"Usar banda simulada"** que arranca la sesión completa sin hardware. Recomendación: ensayar el pitch con los dos, porque el Bluetooth en vivo frente a un jurado es un punto de falla clásico.

## 1. Cuenta y credenciales de Spotify (bloqueante en cualquier escenario)

- [ ] Confirmar que la app está creada en el [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) (Development mode alcanza — tope ~25 usuarios agregados a mano, suficiente para una demo).
- [x] `app/.env` tiene un `EXPO_PUBLIC_SPOTIFY_CLIENT_ID` real (32 caracteres), y se verificó que queda inlineado en el bundle de release — el APK no depende de `.env` en tiempo de ejecución.
- [x] Redirect URI nativo con custom URL scheme implementado: `"scheme": "physical"` en `app.json` y `getRedirectUri()` usando `AuthSession.makeRedirectUri`. Verificado que el intent-filter `android:scheme="physical"` queda en el `AndroidManifest.xml` generado.
- [ ] **Registrar `physical://spotify-auth-callback` en el dashboard de Spotify** (Settings → Redirect URIs). Sin esto el login falla en el APK con `INVALID_CLIENT: Invalid redirect URI` — es el único paso manual que queda entre el APK y un login funcionando.
- [ ] Probar login real al menos una vez en un dispositivo.
- [ ] Nota: `app/.env` todavía tiene una variable `EXPO_PUBLIC_SPOTIFY_REDIRECT_URI` sobrante de la arquitectura con backend. Ya no la lee nadie (`getRedirectUri()` la ignora); se puede borrar.
- [ ] Confirmar que la cuenta de Spotify que se use en la demo es **Premium** — `spotifyPlaybackControl.ts` (play/pause/skip/queue) requiere Premium en todos sus endpoints, documentado así por Spotify.

## 2. Build nativo (bloqueante para BLE y para probar en dispositivo real)

- [x] Build local de APK, sin EAS ni cuenta de Expo: `npm run apk` en `app/` (prebuild + `assembleRelease`, arm64-v8a, packaging comprimido). El APK sale en `android/app/build/outputs/apk/release/`. Se firma con el keystore de debug (default del template de Expo), así que instala directo por sideload — no sirve para Play Store, sí para probar.
- [x] Permisos de Bluetooth declarados vía el plugin de `react-native-ble-plx` en `app.json`, con **`neverForLocation: true`**. Sin ese flag, en Android 12+ el sistema exige además permiso de *ubicación* concedido para entregar resultados de scan, y el código sólo pide `BLUETOOTH_SCAN`/`BLUETOOTH_CONNECT`: el scan habría devuelto cero dispositivos en silencio, en un teléfono moderno, sin ningún error.
- [ ] Probar la app en un dispositivo físico. Hasta ahora se validó que compila, que el bundle nativo incluye el cliente BLE real y que el APK se genera — pero **nunca se vio renderizada en un teléfono**.

## 3. Banda física (sólo si el demo va a usar hardware real — ver punto 0)

- [x] **Firmware del ESP-32 escrito y flasheado** (`firmware/`, PlatformIO). Expone el Heart Rate Service estándar `0x180D` + characteristic `0x2A37`.
- [x] Verificado sobre la placa real: se anuncia como "Physical Band", acepta conexión GATT y notifica 1×/segundo. El BLE arranca aunque el sensor falle.
- [x] `react-native-ble-plx` instalado e integrado end-to-end (scan → conexión → BPM en pantalla) — ver `Stack_tecnico_proyecto.md` §8.
- [ ] **El sensor MAX30102 no funciona: `SDA` está en corto a masa.** El diagnóstico del propio firmware lo aísla (SDA lee LOW 0/20 muestras, SCL OK 20/20 — o sea que la placa sí tiene 3.3V y el jumper de pull-up está bien). Revisar con multímetro continuidad entre `SDA` y `GND`. Hasta arreglarlo, la banda conecta pero reporta "sin sensor" y 0 BPM.
- [ ] Probar el handshake GATT real banda ↔ **teléfono** (el verificado hasta ahora fue banda ↔ laptop).
- [ ] Armar el hardware como banda usable: batería + carcasa. Presupuesto en `Planeacion_proyecto.md` (~$320).

## 4. Cross-referencing de BPM

- [x] ReccoBeats integrado y cacheado en SQLite local (`track_audio_features`) — funciona hoy para el track que está sonando en vivo.
- [x] Flujo simulado end-to-end (sin Spotify): banda simulada → BPM → cola armada por match de BPM contra un pool de tracks de muestra (`mockPlayback.ts`).
- [x] Selección de playlists conectada a la cola real (`services/bpmQueue.ts`): candidatos = Liked Songs + canciones de las playlists marcadas en `PlaylistSelectionScreen`, BPM real vía ReccoBeats, cola armada y visible en `NextUpQueue` cuando hay sesión de Spotify. Se recalcula cuando el BPM leído se mueve lo suficiente (`spotifyStore.refreshQueueForBpm`), no en cada tick.
- [x] Historial de reproducción para no repetir en la cola (`store/playHistoryStore.ts`, tamaño configurable — 10 por defecto) — comparte lógica entre el flujo real y el simulado vía `pickAvoidingRepeats` en `utils/bpmMatch.ts`. Documentado en `Stack_tecnico_proyecto.md` §7.
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

- [x] Respaldo científico verificado y con fuentes reales (`Investigacion_y_pitch_proyecto.md`) — ya corregido para no atribuir nada a la OMS. Incluye el respaldo de inferencia de ánimo desde la muñeca (WESAD / DAPPER) que cita la diapositiva "Lo que viene".
- [ ] Armar la presentación — `Planeacion_proyecto.md` todavía dice literalmente "Falta armar la presentación". La baraja vive en `docs/index.html` (reveal.js, 17 diapositivas).
- [ ] **Cotizar el costo real por unidad en producción.** El precio de venta ya está decidido ($250, con la licencia incluida) y eso le pone techo al costo, pero no hay una cotización en volumen. En la diapositiva de precio ese peldaño es el único punteado a propósito; si el jurado pregunta, hoy no hay número.
- [ ] Definir los rangos exactos de BPM por modo, y si el usuario podrá crear modos propios. (Estaba anotado dentro de la diapositiva de modos; se sacó de ahí al rediseñarla.)
- [ ] Sustituir las dos fotos de referencia de la diapositiva "Qué lleva dentro" (`docs/img/esp32-devkit.jpg`, `docs/img/banda-muneca.jpg`) por fotos reales del prototipo armado y de la banda puesta. Mismos nombres de archivo y no hay que tocar nada más; ver `docs/img/CREDITOS.md`.
- [ ] Preparar explícitamente el plan B: si el Bluetooth falla en vivo (el escenario más probable de falla frente al jurado), caer al flujo 100% simulado (punto 0) — hoy ya funciona y se puede mostrar sin ningún hardware.
