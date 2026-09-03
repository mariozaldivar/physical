(originalmente en `src/INSCTRUCTIONS.md` — nombre de archivo con typo del autor original, corregido aquí al archivar)

(Este es un archivo de instrucciones, al terminar de implementarlas debes archivarlo)

Utilizando medidas simuladas (como lo has planteado hasta ahora), vamos a simular el flujo de la aplicación.
Primero que nada, crea un componete de "start session" que se muestre en medio de la tarjeta de playback en caso de que no esté corriendo el programa. Una vez iniciada la sesión, utilizando el BPM simulado (intenta con un BPM de 120, simulando a alguien haciendo ejercicio), llena la queue con sugerencias que intenten matchear el bpm del usuario.

Implementa todas las funciones y componentes que hagan falta para llegar a este estado.

---

**Estado (archivado 2026-09-03):** hecho.

- `src/components/StartSessionCard.tsx` — CTA centrado (icono de pulso + texto + botón "Conectar banda", con el acento de la zona activa) que reemplaza el empty state genérico de `NowPlayingCard` cuando la sesión no está corriendo. `NowPlayingCard` recibe un `onStartSession?` opcional: si se pasa y `track` es `null`, se muestra `StartSessionCard`; si no, se mantiene el empty state original (caso real: sesión de Spotify activa pero sin nada sonando ahora mismo, donde "conectar banda" no aplica).
- `src/data/mockPlayback.ts` — reescrito: en vez de un queue fijo por zona, ahora hay un `MOCK_TRACK_POOL` (13 tracks, BPM 61–154) que simula "canciones guardadas del usuario + BPM ya resuelto" (lo que en producción vendría de Spotify + ReccoBeats). `pickNowPlayingForBpm(bpm)` y `pickQueueForBpm(bpm, excludeId)` arman "now playing" y la cola tomando los tracks del pool más cercanos al BPM objetivo, con `matchReason` ("mantiene el ritmo" / "sube el ritmo" / "baja el ritmo") calculado contra ese BPM — no hardcodeado por zona.
- `DEMO_START_BPM = { hot: 120, calm: 66 }` — el BPM de arranque pedido explícitamente por la instrucción ("intenta con un BPM de 120, simulando a alguien haciendo ejercicio"). El rango de jitter de la banda simulada (`ZONE_BPM_RANGE`, usado por `refreshReading`) también se amplió para "hot" de `[138,158]` a `[120,158]` para que 120 sea un punto de partida coherente dentro del modo Ejercicio, no un valor fuera de rango.
- `src/store/sessionStore.ts` — ahora es dueño de `nowPlaying`/`queue` simulados (antes vivían en `HomeScreen` leyendo `MOCK_PLAYBACK[zone]` directo). `startSync()` arranca en `DEMO_START_BPM[zone]` y llena ambos vía las funciones de match; `setZone()` hace lo mismo si la sesión ya está corriendo (cambiar de Estudio a Ejercicio a mitad de sesión reacomoda la cola). `refreshReading()` (el tick cada 2.5s) sólo jitterea el BPM mostrado en `BpmMonitorBar` — no recalcula la cola en cada tick, para no hacerla parpadear; el re-cálculo es on-demand (arranque / cambio de zona), consistente con "una vez iniciada la sesión... llena la queue".
- `src/screens/HomeScreen.tsx` — ya no importa `MOCK_PLAYBACK` directo; lee `nowPlaying`/`queue` de `sessionStore` para el camino simulado (sin sesión de Spotify) y sigue usando el `nowPlaying` de `spotifyStore` para el camino real, sin cambios ahí. Pasa `onStartSession` a `NowPlayingCard` sólo cuando corresponde (sin Spotify Y sin banda conectada) — mismo botón "Conectar banda" del header sigue funcionando igual, esto es una entrada adicional más visible.

Verificado con `tsc --noEmit` (limpio) y bundle de Metro para `platform=ios` (sin errores de resolución).
