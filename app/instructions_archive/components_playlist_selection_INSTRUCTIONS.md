(Este es un archivo de instrucciones, al terminar de implementarlas debes archivarlo)

Teniendo en cuenta la estructura actual, crea un componente para "playlist", que tenga un checkmark, y los componentes necesarios para introducir una pantalla adicional donde el usuario pueda leer las playlists que se obtuvieron de su galería, y elegir de cuáles se van a estar obteniendo las canciones que se van a sugerir de acuerdo al BPM. Haz que este sea un menú al que se pueda acceder swipeando a la izquierda. Utiliza tu skill de diseño front-end para esta tarea.

---

**Estado (archivado 2026-09-03):** hecho.

- `src/components/PlaylistRow.tsx` — fila de playlist con checkmark. El check usa `colors.spotifyGreen` (no un acento pulseHot/pulseCalm) porque lo que se marca es contenido de Spotify, no un estado de BPM — mismo criterio que ya usaba `NowPlayingCard` para su atribución a Spotify.
- `src/screens/PlaylistSelectionScreen.tsx` — pantalla con la lista completa de playlists sincronizadas (`FlatList`), contador de seleccionadas, y estados vacíos para "sin sesión" / "sincronizando" / "sin playlists todavía".
- `src/navigation/MainNavigator.tsx` — nuevo Drawer (`@react-navigation/drawer`) que envuelve `HomeScreen`. `drawerPosition: "right"` es lo que hace que el gesto para abrirlo sea deslizar hacia la **izquierda** (el default de React Navigation abre deslizando a la derecha, para un drawer a la izquierda). El panel del drawer no es un menú de navegación — es `PlaylistSelectionScreen` completa, vía la prop `drawerContent`, no una `Drawer.Screen` registrada aparte.
- `src/screens/HomeScreen.tsx` — botón explícito (ícono `albums-outline` junto al wordmark) que abre el drawer con `navigation.dispatch(DrawerActions.openDrawer())`, además del gesto — para que el menú no dependa sólo de un swipe no siempre descubrible.
- Persistencia: `playlists.selected_for_bpm` (columna nueva en `db.ts`, con migración vía `PRAGMA table_info` para instalaciones que ya tenían la tabla) + `setPlaylistSelectedForBpm()` en `spotifyLibrary.ts` + `togglePlaylistSelection()` en `spotifyStore.ts` (optimista: actualiza el estado en memoria y persiste en SQLite). Un re-sync de playlists (`syncPlaylists`) nunca pisa esta columna — no viene de Spotify, es estado propio de la app.
- Dependencias nuevas: `@react-navigation/drawer`, `react-native-gesture-handler`, `react-native-reanimated` (+ `react-native-worklets`, su plugin de babel en Reanimated 4.x) y `babel-preset-expo` como dependencia explícita del proyecto — el repo no tenía `babel.config.js` (se creó uno) ni `babel-preset-expo` a nivel raíz, sólo anidado bajo `expo/`.
- Verificación: `tsc --noEmit` limpio, y bundle de Metro exitoso para `platform=ios` y `platform=android` (el bundle `platform=web` falla, pero por un bug preexistente y no relacionado de `expo-sqlite` en web — ver punto 4 de `Informe_retrieval_datos.md` — no se pudo probar visualmente en un navegador real por falta de Chrome conectado en este entorno).

Pendiente para una fase futura (fuera de esta instrucción): usar las playlists seleccionadas para de verdad alimentar el cross-referencing de `NextUpQueue` (hoy sigue siendo mock) y una pantalla para ver las canciones dentro de cada playlist.
