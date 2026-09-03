INSTRUCCIONES A REALIZAR (archivar este archivo al terminar):

Crea la lógica base para el inicio y guardado de la sesión del usuario (en caso de necesitar acceso a la DB, notificarme y dejar en pausa esa tarea por el momento) en la API de Spotify.

Adicionalmente, crea los helpers y métodos reutilizables que se deban usar para la conexión con la base de datos de BPM de canciones.

---

**Estado (archivado 2026-09-02):**

- Sesión de Spotify (login/guardado): hecho. Ver `app/src/services/spotifyAuth.ts` y `app/src/services/secureStorage.ts`. No requirió DB — la sesión se guarda en el dispositivo (SecureStore nativo / localStorage en web).
- Helpers de conexión a la base de datos de BPM: **en pausa** al momento de archivar este archivo, como pedía la instrucción original (requería acceso a una DB Postgres vía backend que no existía). **Actualización 2026-09-02: se replaneó el stack para eliminar el backend** (ver `Stack_tecnico_proyecto.md` §4 y §7) — la "base de datos de BPM" ahora es una tabla `track_bpm` en el mismo SQLite local que ya usa `db.ts`, sin backend de por medio. El desbloqueo de esta tarea es ahora una implementación client-side normal, no un pendiente de infraestructura.
