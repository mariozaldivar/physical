# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Estado actual del repositorio

Este repositorio contiene únicamente documentación de planeación (Markdown). Todavía no existe código fuente, firmware, app móvil ni backend — no hay comandos de build, lint o test que ejecutar porque no hay ningún proyecto de software inicializado aún. Cuando se empiece a implementar (firmware ESP-32, app React Native, backend Node.js), esta sección y las de comandos deben actualizarse.

## Qué es Physical

"Physical" es un proyecto para el U-Challenge (feria de emprendimiento de la Universidad Anáhuac Mayab): una banda con sensor de pulsaciones (BPM) que se conecta por Bluetooth a una app móvil, la cual usa la API de Spotify para adaptar en tiempo real la cola de reproducción del usuario según su ritmo cardíaco (modo "estudio" vs. modo "ejercicio", configurable).

## Los tres documentos y su propósito

- **`Planeacion_proyecto.md`** — Concepto del producto, flujo funcional del prototipo (banda → app → Spotify), y estrategia de pitch/precio. Es la fuente de verdad sobre _qué_ se está construyendo y por qué.
- **`Stack_tecnico_proyecto.md`** — Decisiones de stack técnico y su justificación, ya con arquitectura definida (ver abajo). Es la fuente de verdad sobre _con qué_ se va a construir.
- **`Investigacion_y_pitch_proyecto.md`** — Respaldo científico verificado (estudios reales, no atribuir nada a la "OMS") para las frases del pitch, con las fuentes exactas y en qué sección de cada artículo aparece cada dato.

Al responder preguntas sobre el proyecto, tratar estos tres documentos como la fuente de contexto — no inventar detalles de producto, stack o datos científicos que no estén en ellos.

## Arquitectura planeada

```
Banda ESP-32 (firmware C++/PlatformIO, BLE Heart Rate Service 0x180D)
        │ BLE
        ▼
App móvil (React Native + TypeScript, Expo Development Build — NO Expo Go, por soporte BLE)
        │ HTTPS (OAuth 2.0 PKCE)         │ HTTPS
        ▼                                 ▼
Spotify Web API + Connect          Backend (Node.js + TypeScript + Fastify/Express)
                                            │ SQL (Prisma ORM)
                                            ▼
                                    PostgreSQL (canciones, BPM, preferencias de usuario)
```

Puntos de diseño no obvios a tener en cuenta si se implementa código:

- El sensor de la banda debe exponer el **Heart Rate Service BLE estándar (UUID 0x180D)**, no un protocolo propio — así cualquier librería BLE del ecosistema fitness (y `react-native-ble-plx` del lado de la app) lo lee sin adaptadores custom.
- **Expo Go no soporta BLE nativo.** El proyecto debe usarse con Expo Development Build (`expo prebuild` + `eas build --profile development`) desde el inicio, no como migración posterior.
- Auth contra Spotify debe ser **OAuth 2.0 con PKCE**, sin client secret embebido en la app (requisito de seguridad para apps móviles públicas).
- **Riesgo técnico crítico:** Spotify deprecó el acceso público a `audio-features` (que daba el tempo/BPM de canciones) en noviembre de 2024. No asumir que esa API seguirá disponible sin "Extended Quota Mode" aprobado. Alternativas evaluadas en `Stack_tecnico_proyecto.md`: GetSongBPM API, datasets fijos de Kaggle, o análisis propio de audio con `librosa` (fuera de alcance para el prototipo).
- Lógica de emparejamiento canción↔BPM: la app lee BPM de la banda, lo cruza contra las canciones guardadas del usuario (extraídas vía Spotify API) más una base de datos de BPM por canción, y añade a la cola (o hace skip si el cambio de ritmo es muy drástico) la canción que caiga en el rango configurado.

## Reglas de integración con la Spotify Web API

Al escribir o revisar cualquier código que interactúe con la Spotify Web API, seguir estas reglas:

- **OpenAPI spec**: consultar la especificación OpenAPI de Spotify (https://developer.spotify.com/reference/web-api/open-api-schema.yaml) para paths, parámetros y schemas de respuesta de cualquier endpoint. No adivinar endpoints ni nombres de campos.
- **Autorización**: usar el flujo Authorization Code with PKCE (https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow) para cualquier dato específico de usuario. Si la app tiene backend seguro, el flujo Authorization Code (https://developer.spotify.com/documentation/web-api/tutorials/code-flow) también es aceptable. Usar Client Credentials solo para datos públicos no asociados a un usuario. Nunca usar Implicit Grant (deprecado).
- **Redirect URIs**: siempre HTTPS (excepto `http://127.0.0.1` para desarrollo local). Nunca `http://localhost` ni wildcards. Ver https://developer.spotify.com/documentation/web-api/concepts/redirect_uri.
- **Scopes**: solicitar solo los scopes mínimos (https://developer.spotify.com/documentation/web-api/concepts/scopes) necesarios para la feature en construcción. No pedir scopes amplios de forma preventiva.
- **Manejo de tokens**: almacenar tokens de forma segura. Nunca exponer el Client Secret en código de cliente. Implementar refresh de tokens (https://developer.spotify.com/documentation/web-api/tutorials/refreshing-tokens) y reenviar al usuario a autorizar de nuevo cuando el refresh token expire.
- **Rate limits**: implementar backoff exponencial y respetar el header `Retry-After` en respuestas HTTP 429. No reintentar de inmediato ni en loops apretados.
- **Endpoints deprecados**: no usarlos. Preferir `/playlists/{id}/items` sobre `/playlists/{id}/tracks`, y `/me/library` sobre los endpoints de librería específicos por tipo.
- **Manejo de errores**: manejar todos los códigos HTTP de error documentados en el schema OpenAPI. Leer el mensaje de error devuelto y usarlo para dar feedback significativo al usuario.
- **Developer Terms of Service**: cumplir los Spotify Developer Terms (https://developer.spotify.com/terms). En particular: no cachear contenido de Spotify más allá de lo necesario para uso inmediato, siempre atribuir el contenido a Spotify, y no usar la API para entrenar modelos de machine learning con datos de Spotify.

## Convención del proyecto para cambios de sistema/entorno

Instrucción del usuario (ver `/home/Mario/CLAUDE.md`, aplica globalmente): cualquier cambio de configuración del sistema o del entorno debe documentarse en un archivo `.md` dentro de una carpeta dedicada `CLAUDE_ACTIONS/`, lo más conciso posible, incluyendo qué se cambió, cómo replicarlo, sus implicaciones y cómo revertirlo. Esto no aplica a cambios normales de código de la aplicación — solo a configuración de sistema/entorno.
