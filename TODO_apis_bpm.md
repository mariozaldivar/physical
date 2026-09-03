# TODO — Cuentas y API keys pendientes (fuentes de BPM)

Relacionado con la sección 7 de `Stack_tecnico_proyecto.md`. Antes de poder implementar el cross-referencing completo de BPM, falta:

- [ ] **GetSongBPM** — registrarse en https://getsongbpm.com/api con un email válido y obtener API key. Guardar la key como variable de entorno de la app (`EXPO_PUBLIC_GETSONGBPM_API_KEY` en `app/.env`, nunca hardcodeada ni en el repo) — **ya no hay backend** (ver `Stack_tecnico_proyecto.md` §4), así que la key queda visible en el bundle cliente; es un riesgo aceptado documentado en esa sección. Recordar el requisito de atribución (link visible a GetSongBPM) según sus términos.
- [ ] **Kaggle** — crear cuenta gratuita en https://www.kaggle.com para poder descargar el dataset fijo (ej. `maharshipandya/spotify-tracks-dataset`) usado como safety net offline.

No pendiente: **ReccoBeats** no requiere cuenta ni API key — se puede integrar directo.
