
# Stack técnico — Physical

Basado en las features descritas en `Planeacion_proyecto.md`. Criterios de diseño, en orden de prioridad:

1. **Multiplataforma real** — la app debe correr en iOS y Android (idealmente sin duplicar código).
2. **Tecnologías con alta demanda laboral** — priorizar herramientas que aparecen seguido en vacantes de dev, no herramientas de nicho aunque sean "más fáciles" para un hackathon.
3. **Velocidad de desarrollo** — es un prototipo para un U-Challenge, no un producto en producción. El stack debe permitir armar un demo funcional rápido.

---

## 1. Arquitectura general

**Cambio de arquitectura (2026-09-02): se eliminó el backend.** La app corre 100% client-side — sin Node.js, sin PostgreSQL, sin hosting de servidor. Todo el cross-referencing de BPM que antes se planeaba resolver contra un backend con Postgres ahora vive en el mismo SQLite local (`expo-sqlite`) que ya cachea la librería de Spotify del usuario (`app/src/services/db.ts`). Justificación y trade-offs en la sección 4.

```
┌─────────────┐   BLE (Heart Rate      ┌────────────────────────────────────────────┐
│  Banda ESP32 │──  Service estándar ──▶│              App móvil                     │
│  (firmware)  │      0x180D)           │           (React Native)                   │
└─────────────┘                         │                                             │
                                         │  ┌───────────────────────────────────────┐  │
                                         │  │  SQLite local (expo-sqlite)            │  │
                                         │  │  - playlists, liked_tracks (cache)     │  │
                                         │  │  - track_bpm (cross-reference BPM)     │  │
                                         │  └───────────────────────────────────────┘  │
                                         └───────────────┬─────────────────┬───────────┘
                                                          │ HTTPS                        │ HTTPS
                                                          │ (OAuth PKCE)                 │
                                                          ▼                              ▼
                                                ┌──────────────────┐         ┌───────────────────────┐
                                                │  Spotify Web API  │         │  ReccoBeats /          │
                                                │  + Spotify Connect│         │  GetSongBPM (BPM APIs) │
                                                └──────────────────┘         └───────────────────────┘
```

---

## 2. Firmware de la banda (ESP-32)

| Elemento             | Elección                                                                                    | Por qué                                                                                                                                                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lenguaje / framework | **C++ con Arduino framework**, vía **PlatformIO** (no el IDE de Arduino)                    | PlatformIO es el estándar profesional para firmware embebido: manejo de dependencias, debugging, y multi-target real. Se ve mejor en un portafolio que "hecho en Arduino IDE".                                                                                                                         |
| Comunicación         | **BLE (Bluetooth Low Energy)**, exponiendo el **Heart Rate Service estándar (UUID 0x180D)** | Es el mismo protocolo que usan bandas comerciales (Polar, Garmin, etc). Al usar el perfil estándar, **cualquier librería BLE de la industria fitness ya sabe leerlo** — no hay que inventar un protocolo propio, y las librerías del lado de la app (abajo) tienen soporte directo para este servicio. |
| Sensor BPM           | El que ya tengan cotizado (ej. MAX30102/MAX30105 por I2C)                                   | No es una decisión de software; solo asegurarse de que el sensor puede alimentar el Heart Rate Service vía notificaciones BLE.                                                                                                                                                                         |

---

## 3. App móvil (multiplataforma)

**Recomendación: React Native + TypeScript, con Expo (usando "Development Builds", no Expo Go).**

| Por qué React Native y no la alternativa (Flutter)                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React Native comparte paradigma y buena parte del ecosistema con React (el framework web más pedido en el mercado laboral). Aprender RN es, en la práctica, aprender React + un runtime nativo — la inversión se paga doble. |
| Flutter/Dart es un buen framework, pero Dart tiene muchísima menos demanda laboral fuera de Flutter mismo. Para el objetivo de "aprender algo provechoso", RN tiene mejor retorno.                                           |
| Expo permite compilar para iOS y Android desde una sola base de código, con builds en la nube (EAS Build) — no se necesita una Mac para generar el build de iOS.                                                             |

**Nota técnica importante:** Expo Go (la app de preview) **no soporta BLE nativo**. Hay que usar un *Expo Development Build* (`expo prebuild` + `eas build --profile development`) desde el día 1 del proyecto, no intentar migrar después.

| Pieza                | Elección                                                      | Por qué                                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lenguaje             | **TypeScript**                                                | Estándar de facto en cualquier vacante de frontend/RN moderna.                                                                                                                         |
| Comunicación BLE     | `react-native-ble-plx`                                        | Librería más madura del ecosistema RN para BLE; soporta directamente perfiles GATT estándar como el Heart Rate Service.                                                                |
| Estado global        | **Zustand**                                                   | Más simple que Redux para un proyecto de este tamaño, pero sigue siendo una skill transferible y cada vez más pedida (ha desplazado a Redux en muchos stacks nuevos).                  |
| Navegación           | `react-navigation`                                            | Estándar del ecosistema RN.                                                                                                                                                            |
| Auth con Spotify     | **OAuth 2.0 con PKCE** (sin client secret embebido en la app), redirect URI nativo con **custom URL scheme** (ej. `physical://spotify-auth-callback`) | Es el flujo correcto y seguro para apps públicas sin backend. Ya implementado con `expo-auth-session` (`app/src/services/spotifyAuth.ts`). **Nota de arquitectura (verificado 2026-09-02 contra el [blog post oficial de Spotify, feb 2025](https://developer.spotify.com/blog/2025-02-12-increasing-the-security-requirements-for-integrating-with-spotify)):** Spotify permite explícitamente custom URL schemes como redirect URI en apps móviles ("*Redirects using a custom scheme will still be supported*"), lo cual cierra la última pieza que parecía necesitar un backend — el deep link de vuelta a la app ya no requiere un endpoint HTTPS intermedio. Pendiente de implementar: registrar el `scheme` en `app.json` y actualizar `getRedirectUri()` en `spotifyAuth.ts` para nativo (hoy espera una URL HTTPS vía `EXPO_PUBLIC_SPOTIFY_REDIRECT_URI`, que ya no hace falta). En web se mantiene el loopback `http://127.0.0.1:<puerto>` para desarrollo, sin cambios. |
| Almacenamiento local | **`expo-sqlite`** (decidido, ya implementado en `app/src/services/db.ts`) | Es la única base de datos del proyecto — no solo cache. Guarda la librería de Spotify del usuario (`playlists`, `liked_tracks`, `playlist_tracks`) **y** la tabla de cross-reference `track_bpm` (ver sección 7). Se descartó `WatermelonDB`: no aporta nada aquí (no hay sync multi-dispositivo ni backend con el que reconciliar) y añade complejidad de configuración innecesaria para un prototipo. |
| Testing              | Jest (unit) + Detox (E2E, opcional si da tiempo)              | Estándar del ecosistema RN.                                                                                                                                                            |

---

## 4. Backend

**Decisión (2026-09-02): no hay backend. La app es 100% client-side.**

Se elimina la capa de Node.js + Fastify/Express + Prisma + PostgreSQL que planeaba este documento anteriormente. Todo lo que se le pedía al backend ya se resuelve sin servidor:

| Lo que hacía el backend | Cómo se resuelve ahora, client-side |
|---|---|
| Guardar sesión de Spotify | `expo-secure-store` en el dispositivo (nativo) / `localStorage` (web) — ya implementado en `secureStorage.ts`, nunca necesitó backend. |
| Completar el redirect de OAuth PKCE | Custom URL scheme (`physical://...`) en nativo, loopback en web — ver nota en sección 3. No requiere un endpoint HTTPS intermedio. |
| Cross-reference BPM ↔ canciones guardadas | Tabla `track_bpm` en el mismo SQLite local que ya cachea la librería de Spotify (ver sección 7). El device llama directo a ReccoBeats/GetSongBPM y guarda el resultado. |
| Persistir preferencias del usuario (modo estudio/ejercicio, rangos de BPM) | Otra tabla en el mismo SQLite local — no necesita estar en un servidor porque no hay multi-dispositivo ni multi-usuario compartido en el prototipo. |

**Por qué este cambio, en orden de peso:**

1. **El prototipo nunca necesitó estado compartido entre usuarios ni entre dispositivos.** Cada usuario trae su propia banda y su propio teléfono; no hay una razón de producto (todavía) para centralizar nada en un servidor.
2. **Menos piezas móviles para un equipo estudiantil con tiempo limitado de feria.** Sin backend no hay que levantar, desplegar, ni tener corriendo un servidor (Railway/Render) el día del pitch — un punto de falla menos en vivo.
3. **Mismo patrón que ya se usa para Spotify.** La integración con Spotify (auth, playlists, now-playing) ya corre 100% device→API directo, sin pasar por servidor propio (ver `Informe_retrieval_datos.md`). Meter BPM al mismo patrón es más consistente que tener una sola pieza de datos dependiendo de una arquitectura distinta.

**Trade-offs aceptados (documentarlos es parte de la decisión, no un descuido):**

- **La API key de GetSongBPM queda embebida en el bundle cliente** (`EXPO_PUBLIC_GETSONGBPM_API_KEY` o similar), visible para cualquiera que inspeccione la app. Antes el backend la hubiera ocultado. Para un prototipo de feria esto es un riesgo aceptado — no es una credencial de pago ni da acceso a datos de usuario, solo rate-limita una API pública de lookup de tempo. Si el proyecto pasa a producto real, esto sí ameritaría volver a meter una capa server-side (aunque sea una function serverless, no un backend completo).
- **Sin invalidación/sync entre dispositivos.** Si el mismo usuario usa la app en dos teléfonos, cada uno tiene su propio cache SQLite — ya era así para la librería de Spotify (ver punto 5 de `Informe_retrieval_datos.md`), ahora aplica igual a BPM.
- **Rate limits de las APIs de BPM se pegan directo al device del usuario**, no a un servidor propio con su propio budget — mitigado porque el cross-reference es lookup por track (no bulk), y con el dataset de Kaggle como safety net offline (sección 7) cuando las APIs fallan o se agota la cuota.

---

## 5. ⚠️ Riesgo técnico crítico: fuente de datos de BPM de canciones

El concepto depende de tener el **tempo (BPM) de cada canción** para hacer el cross-referencing con las canciones guardadas del usuario. El plan original menciona usar la API de Spotify para esto — **hay un problema real aquí que hay que resolver antes de comprometerse con el pitch:**

Spotify **deprecó el acceso público al endpoint `audio-features`** (que devolvía el tempo/BPM) en noviembre de 2024 para apps nuevas sin "Extended Quota Mode". Esto significa que **no se puede asumir que la API de Spotify seguirá dando el BPM de una canción directamente**, a menos que se solicite y se apruebe acceso extendido (proceso de Spotify, no inmediato).

**Actualización (verificado 2026-09-02 contra el changelog oficial de Spotify):** ese mismo anuncio del 27 nov 2024 restringió, junto con `audio-features`, también **`/recommendations`**, `/audio-analysis`, `related-artists`, y las playlists editoriales/algorítmicas de Spotify, para toda app nueva o en modo desarrollo sin extensión aprobada. La app "Physical" está en Development mode, así que tampoco tiene acceso a recomendaciones del algoritmo de Spotify — no solo al BPM. Detalle en `app/Informe_retrieval_datos.md`.

**Alternativas a evaluar (para la parte técnica del prototipo, no necesariamente para el pitch):**
- **GetSongBPM API** (getsong.co) — API pública dedicada específicamente a esto.
- **Datasets pre-calculados** (ej. datasets públicos de Spotify Tracks con tempo, disponibles en Kaggle) — sirve para tener un demo funcional con un catálogo fijo de canciones sin depender de una API externa en vivo.
- **Análisis propio del audio** — usando previews de 30 segundos y una librería de tempo-detection (ej. `librosa` en un microservicio Python) — más complejo, probablemente fuera de alcance para el tiempo disponible, pero es la opción más "propia" si quieren venderlo como tecnología diferenciadora.

Recomendación para el prototipo: usar **GetSongBPM o un dataset fijo** para la demo, y mencionar en el pitch que la versión de producto real evaluaría análisis propio de audio como ventaja competitiva a futuro — sin comprometerse a que ya funciona así.

Este riesgo es independiente de dónde vive el backend — sigue siendo válido con la arquitectura 100% client-side de la sección 4. Lo único que cambia es *quién* llama a estas APIs (el device directo, no un servidor) y *dónde* se cachea el resultado (SQLite local, ver sección 7).

---

## 6. Resumen del stack

| Capa | Tecnología |
|---|---|
| Firmware | C++ (Arduino framework) + PlatformIO, BLE Heart Rate Service (0x180D) |
| App móvil | React Native + TypeScript + Expo (dev build), `react-native-ble-plx`, Zustand |
| Auth | OAuth 2.0 PKCE contra Spotify, redirect vía custom URL scheme en nativo (sin backend) |
| Almacenamiento / cross-reference BPM | `expo-sqlite` (local, on-device) — reemplaza a Prisma + PostgreSQL |
| Backend | ~~Node.js + Fastify/Express~~ — **eliminado**, ver sección 4 |
| Hosting | ~~Railway / Render~~ — **eliminado**, no hay servidor que hostear |
| Datos de BPM de canciones | GetSongBPM API o dataset fijo (Spotify `audio-features` no es confiable a futuro), consultado directo desde el device |
| Control de versiones / CI | Git + GitHub, GitHub Actions (opcional si da tiempo) |

**Por qué este stack cumple los objetivos:** React Native/TypeScript y OAuth PKCE siguen entre las tecnologías más pedidas en vacantes de desarrollo, el proyecto corre nativamente en iOS y Android desde una sola base de código, y al quitar el backend el equipo gana velocidad de desarrollo (criterio #3 de este documento) sin sacrificar ninguna feature del prototipo — ver sección 4 para el detalle de la decisión y sus trade-offs.

---

## 7. Estructura de fuentes de BPM (cross-reference con Spotify) — ahora 100% local

Dado que Spotify deprecó `audio-features` (ver sección 5), se define la siguiente estructura de tres capas para obtener el tempo/BPM de las canciones del usuario. **Cambio respecto a la versión anterior de este documento: las tres capas se consultan directo desde el device (no desde un backend) y el resultado se persiste en una tabla nueva del mismo SQLite local que ya usa `app/src/services/db.ts` para cachear la librería de Spotify.**

| Capa | Fuente | Rol | ¿Requiere cuenta / API key? |
|---|---|---|---|
| 1. Primaria | **ReccoBeats** (`api.reccobeats.com`) | Lookup directo por Spotify track ID — sin necesidad de matchear por nombre/artista | **No** — sin cuenta ni API key |
| 2. Fallback | **GetSongBPM** (`getsongbpm.com/api`) | Cuando ReccoBeats no tenga cobertura del track; lookup por nombre + artista, ~3,000 req/hora | **Sí** — requiere registro con email para obtener API key. Se guarda como `EXPO_PUBLIC_GETSONGBPM_API_KEY` en `app/.env` — ver trade-off de exposición client-side en sección 4. |
| 3. Safety net offline | **Dataset Kaggle** (ej. `maharshipandya/spotify-tracks-dataset`) | Catálogo fijo pre-cargado (empaquetado como asset de la app o pre-sembrado en el SQLite en build time) para la demo, por si ambas APIs fallan en vivo | **Sí** — requiere cuenta gratuita de Kaggle para descargar el CSV |

Nota de cobertura: ReccoBeats tiene huecos reportados en lanzamientos recientes o fuera del catálogo de sellos grandes — conviene correr una prueba temprana contra una librería real de "Liked Songs" de Spotify para medir el hit-rate antes de comprometerse a esta arquitectura como única fuente.

### Schema local (implementado en `app/src/services/db.ts`)

**Actualización (2026-09-03): la capa 1 (ReccoBeats) ya está implementada** — ver
`app/instructions_archive/services_audio_features_INSTRUCTIONS.md`. Las capas 2
(GetSongBPM) y 3 (dataset Kaggle) siguen pendientes de credenciales (`TODO_apis_bpm.md`).
La tabla terminó llamándose `track_audio_features`, no `track_bpm` como se había
propuesto aquí originalmente: ReccoBeats devuelve el set completo de audio features
(tempo + mood: valence, energy, danceability, etc.), y la instrucción pedía guardar
"el mood, bpm, etc", no sólo el tempo.

```sql
CREATE TABLE IF NOT EXISTS track_audio_features (
  spotify_track_id TEXT PRIMARY KEY,
  source TEXT NOT NULL,        -- 'reccobeats' (única fuente implementada hasta ahora)
  tempo REAL NOT NULL,         -- BPM
  valence REAL,                -- "positividad" musical 0-1 — el proxy de mood más cercano
  energy REAL,
  danceability REAL,
  acousticness REAL,
  instrumentalness REAL,
  liveness REAL,
  loudness REAL,
  speechiness REAL,
  fetched_at INTEGER NOT NULL  -- epoch ms, para poder decidir a futuro si vale la pena un TTL/refresh
);
```

Flujo de lookup real (`app/src/services/audioFeatures.ts`, mismo patrón lazy que ya
usa `getPlaylistItems` en `spotifyLibrary.ts`): `getAudioFeaturesForTracks(ids)`
primero lee `track_audio_features` local; sólo los IDs que falten se piden a
ReccoBeats (`app/src/services/reccobeats.ts`), y el resultado se guarda de vuelta.
Cuando se implementen las capas 2 y 3, este es el punto donde se encadenan como
fallback. Ya está conectado a la tarjeta de now-playing (`spotifyStore.refreshNowPlaying`
enriquece `nowPlaying.track.bpm` con esto). El cross-referencing real de `NextUpQueue`
(hoy sigue siendo mock, ver `Informe_retrieval_datos.md` §3) puede construirse sobre
`track_audio_features` directamente: es un `JOIN` en SQLite entre `liked_tracks`/
`playlist_tracks` y `track_audio_features` por `spotify_track_id`, sin red de por
medio una vez poblada la tabla.

Pendientes de cuentas/API keys para las capas 2 y 3: ver `TODO_apis_bpm.md`.
