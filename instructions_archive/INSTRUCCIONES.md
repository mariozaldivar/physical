Este es un archivo de instrucciones. Al terminar de implementarlas, archívalo adecuadamente.

Voy a estar AFK, entonces te dejaré una serie de tareas que quiero que realices de forma totalmente autónoma (sin conectarlas al software del todo aún, pero empieza a desarrollarlas).

- Empieza y haz todas las bases del código para el ESP-32, teniendo en cuenta que este utiilizará un componente MAX30102 para la lectura del pulso. Implementa el sistema de lectura base, la conexión por bluetooth, etc, y crea los scripts necesarios en la aplicación para conectarse a este ESP-32 (aunque aún no estén integrados).
- Termina y asegúrate de que no haya errores en el flujo de uso del usuario. Asegúrate de que la rutina funcione perfectamente, en la cual un usuario pueda solo darle a "empezar sesión", y se empiecen a añadir canciones a su cola (que se deben reproducir después de la canción actual) cuyo bpm coincida con el actual pulso cardiaco del usuario. 
- Pule la UX al máximo, y mejora el diseño del front-end.

En caso de tener dudas o llegar a un punto muerto, analiza el documento de contexto y planeación de la app (el emprendimiento para la feria del emprendimiento), y guíate imaginando una app en producción con esas features. 

Trabaja hasta agotar tu límite de uso actual.

---

**Estado (archivado 2026-09-03):** hecho, las tres tareas. Sesión larga y autónoma
(usuario AFK) — resumen por tarea, con los archivos tocados. Se inicializó git en
la raíz del proyecto al empezar (no existía) para poder dejar un historial
revisable de todo lo hecho; commits: snapshot inicial, luego uno por tarea grande.

## Tarea 1 — Firmware ESP-32 + scripts de conexión en la app

- `firmware/`: proyecto PlatformIO nuevo y completo (`platformio.ini`, `include/`,
  `src/`). `HeartRateSensor` (MAX30102 vía SparkFun MAX3010x library — algoritmo
  de BPM verificado contra el código fuente real de `Example5_HeartRate` del
  repo oficial de SparkFun, no adivinado) + `BleHeartRateService` (Heart Rate
  Service BLE estándar del Bluetooth SIG, UUID `0x180D`/característica `0x2A37`,
  con Body Sensor Location y reanudo de advertising al desconectar) + `main.cpp`
  que une ambos. Detalle de wiring, build/flash y verificación en
  `firmware/README.md`. **No se pudo compilar ni flashear** — no hay PlatformIO
  instalado en este entorno ni hardware físico conectado; queda para cuando el
  usuario tenga la banda armada (ver `Planeacion_proyecto.md` para el presupuesto).
- `app/src/services/bleHeartRateService.native.ts`: cliente BLE real con
  `react-native-ble-plx` (nueva dependencia) — scan filtrado por el Heart Rate
  Service estándar, connect + discovery, subscribe a notificaciones del
  characteristic de medición con parseo del formato real de la spec (flags,
  UINT8/UINT16, contacto de sensor), permisos de Android en runtime
  (BLUETOOTH_SCAN/CONNECT en API 31+, ubicación en versiones previas). Vive en
  un archivo `.native.ts` a propósito: Metro lo excluye del bundle web por
  convención de plataforma — **verificado** con un import temporal (revertido):
  bundlea limpio en iOS/Android, y en web falla a *resolver* con un error claro
  de build en vez de romperse en runtime. **No está conectado** a
  `BleConnectModal`/`sessionStore` todavía — no hay banda física con la que
  probar el handshake real, tal como preveía la instrucción ("aunque aún no
  estén integrados"). Mismo shape de `DiscoveredDevice`/`ScanHandle` que el
  scanner simulado (`bleScanner.ts`) para que conectarlo después sea, en lo
  posible, un cambio de import — ver el comentario al inicio del archivo.
- `app/app.json`: `"scheme": "physical"` (necesario también para el fix de
  login nativo de la tarea 2) + plugin de Expo para `react-native-ble-plx`
  (`modes: ["central"]` únicamente — la app nunca actúa como peripheral BLE).

## Tarea 2 — Bugs del flujo "conectar banda → cola por BPM"

Se leyó el código completo (stores, services, screens, components) antes de
tocar nada. Bugs reales encontrados y corregidos:

- **Login en nativo era irrecuperable**: `spotifyAuth.ts` `getRedirectUri()`
  pedía `EXPO_PUBLIC_SPOTIFY_REDIRECT_URI` (HTTPS) para cualquier build nativo,
  variable que nunca se llenó ni se pudo llenar — apuntaba a un backend que ya
  se había eliminado de la arquitectura (ver `Stack_tecnico_proyecto.md` §3-4).
  Sin esto, nadie pudo iniciar sesión real de Spotify en un dispositivo/dev
  build desde que se hizo ese cambio de arquitectura, lo cual también explica
  por qué otros bugs de abajo (BPM real sin redondear, error 403) nunca se
  habían visto en la práctica. Ahora usa el custom URL scheme
  `physical://spotify-auth-callback` vía `AuthSession.makeRedirectUri({scheme,
  path})`, tal como ya documentaba (pero nunca implementaba)
  `Stack_tecnico_proyecto.md` §3. **Pendiente del usuario**: registrar ese
  redirect URI tal cual en el dashboard de Spotify (Settings → Redirect URIs).
- `BleConnectModal.tsx`: cancelar (botón o tocar el fondo) mientras el estado
  era "connecting" no interrumpía la conexión simulada en curso — completaba
  en segundo plano y podía arrancar una sesión (`startSync`) después de que el
  usuario ya había cerrado el modal. Fix con un ref de "modal activo".
- `HomeScreen.tsx` + `NowPlayingCard.tsx`: con sesión real de Spotify pero
  banda sin conectar, el único CTA visible para conectar la banda
  desaparecía de la tarjeta principal (quedaba sólo el botón chico del
  header) — el `onStartSession` se pasaba condicionado a "sin sesión de
  Spotify", no a "banda sin conectar", que era la condición correcta.
- BPM real (ReccoBeats) se mostraba sin redondear en `NowPlayingCard.tsx` y
  `NextUpQueue.tsx` (`track.bpm` es `REAL`/float en SQLite) — invisible hasta
  ahora porque el login nativo nunca funcionó, así que nunca había BPM real en
  pantalla, sólo el mock (enteros a propósito).
  `spotifyStore.ts`: error 403 de Spotify en los endpoints de `/me/player` se
  atribuía sólo a "cuenta no Premium" — verificado contra reportes reales de
  la comunidad de developers de Spotify que 403 en esos endpoints casi siempre
  es "Insufficient client scope" (sesión guardada de antes de que se pidieran
  los scopes de control de playback). El mensaje ahora cubre ambas causas.
- `spotifyStore.ts`: `stopSync` (banda) no limpiaba la cola/errores reales
  armados por BPM — quedaban visibles tras "Detener" como si la sesión
  siguiera activa. `clearQueue` nuevo, conectado en `HomeScreen`.
- `spotifyStore.ts` + `HomeScreen.tsx`: si el usuario conectaba la banda antes
  de que terminara el primer sync de una librería grande, la cola podía
  quedar vacía y no reintentarse hasta que el BPM se moviera lo suficiente por
  su cuenta (podía tardar varios segundos) — `refreshQueueForBpm` ahora acepta
  un `force` que se usa apenas termina ese primer `syncLibrary()`.

Verificado en todo momento con `tsc --noEmit` (limpio) y `expo export` para
`web`/`ios`/`android` (bundlea sin errores) — no se pudo probar visualmente en
un navegador o dispositivo real (sin Chrome conectado ni hardware en este
entorno, mismo límite que sesiones anteriores — ver `Informe_retrieval_datos.md`).

## Tarea 3 — Pulido de UX / diseño

Se usó el skill de diseño de frontend del proyecto antes de tocar estilos
(misma convención que las instrucciones archivadas anteriores). No fue un
rediseño — la identidad visual ya existente (azul-tinta + acentos
hot/calm + Space Grotesk, ver `theme.ts`) ya es distintiva y bien pensada;
el trabajo fue de jerarquía, feedback de estado y consistencia:

- El botón "Iniciar sesión" del header (CTA principal del producto) pasó de
  outline sutil a fondo sólido con el acento de zona — mismo tratamiento que
  ya usaba `StartSessionCard`. Texto renombrado a "Conectar banda" (idle) para
  no chocar con "iniciar sesión" = login, que es una acción distinta en la
  misma pantalla.
- Estados de error/éxito de la cola (`HomeScreen`) rediseñados como chips con
  fondo e ícono propios en vez de texto plano — el error usa
  `colors.pulseHotDim`/`pulseHot` (tokens que ya existían en `theme.ts` sin
  usar en ningún componente) en vez de inventar un color nuevo.
- Indicadores de carga nuevos: "Actualizando…" en `NextUpQueue` mientras se
  recalcula la cola real o sincroniza la biblioteca con la banda conectada;
  "Sincronizando…" junto al contador de `PlaylistSelectionScreen` cuando ya
  hay playlists cacheadas pero corre un re-sync en segundo plano (antes sólo
  había indicador en el estado vacío).
- `BpmMonitorBar` ya soportaba un estado visual "scanning" (punto naranja,
  "Buscando banda…") que `sessionStore` nunca activaba — saltaba directo de
  disconnected a connected. Ahora `HomeScreen` lo deriva (sin tocar el store)
  mientras el modal BLE está abierto buscando.
- `BleConnectModal`: pequeña animación de "pop" (spring) en el check de
  conexión exitosa — el único momento de éxito del modal. Fila de dispositivo
  ahora `disabled` de verdad (no sólo ignorado en el handler) fuera del
  estado "scanning".
- Accesibilidad: `accessibilityRole`/`accessibilityLabel` (y `accessibilityState`
  donde aplica: checkbox de playlist, toggle de zona) en todos los elementos
  interactivos que no lo tenían — antes sólo `SpotifyLoginButton` los tenía.

## Notas para quien retome esto

- El bug de login nativo era el bloqueador real detrás de varios "no se pudo
  probar en dispositivo real" de `Checklist_demo_proyecto.md` — vale la pena
  releer ese checklist, se actualizó junto con este archivo pero varios puntos
  cambiaron de categoría.
- El flujo 100% simulado (sin Spotify, banda mock) sigue intacto como plan B
  garantizado para la demo — nada de lo de arriba lo tocó de forma que rompa
  ese camino.
- `firmware/` y `bleHeartRateService.native.ts` son la base pedida, no un
  sistema probado end-to-end con hardware — eso requiere tener la banda física
  armada primero.
