# Notas para la futura pantalla de configuración

Aspectos identificados durante el trabajo del rate limiter de la cola (ver
`store/playHistoryStore.ts` y `store/spotifyStore.ts`) que deben quedar
expuestos al usuario en una pantalla de Configuración cuando se construya:

- **Alcance del anti-repetición**: cuántas canciones recientes se recuerdan
  para no volver a recomendarlas/encolarlas. Hoy es una constante
  (`DEFAULT_PLAY_HISTORY_SIZE` en `store/playHistoryStore.ts`, valor 15) — la
  pantalla de configuración debe permitir cambiar este número y persistirlo
  (llamar `recordPlayed(trackId, limit)` con el valor elegido por el usuario
  en vez del default).

- **Cuánto tiene que sostenerse un cambio de BPM antes de rearmar la cola**:
  hoy es una constante (`BPM_CHANGE_SUSTAIN_MS` en `store/spotifyStore.ts`,
  valor 20 segundos) — controla qué tan sensible es Physical a cambios de
  ritmo cortos vs. sostenidos. Candidato a exponerse como slider (ej. "5s" a
  "60s") junto al umbral de BPM notable (`BPM_RECOMPUTE_THRESHOLD`, hoy 12).
