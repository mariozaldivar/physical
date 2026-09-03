import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

/**
 * Cache local de la librería de Spotify del usuario (playlists, liked songs,
 * y canciones por playlist consultadas bajo demanda). Es intencionalmente
 * simple: sync = fetch completo + upsert. Estrategias de staleness/TTL,
 * sync incremental, etc. quedan para discutir — ver app/Informe_retrieval_datos.md.
 */
let dbPromise: Promise<SQLiteDatabase> | null = null;

/**
 * `ALTER TABLE ... ADD COLUMN` no soporta `IF NOT EXISTS` en SQLite — hay que
 * chequear `PRAGMA table_info` primero. Necesario porque `selected_for_bpm` se
 * añadió después de que `playlists` ya existía en instalaciones existentes.
 */
async function ensureColumn(db: SQLiteDatabase, table: string, column: string, ddl: string): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (columns.some((col) => col.name === column)) return;
  await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}

export function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabaseAsync("physical.db")
      .then(async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS playlists (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          owner_name TEXT,
          image_url TEXT,
          track_count INTEGER NOT NULL,
          synced_at INTEGER NOT NULL,
          selected_for_bpm INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS liked_tracks (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          artists TEXT NOT NULL,
          album_name TEXT,
          image_url TEXT,
          duration_ms INTEGER NOT NULL,
          added_at TEXT NOT NULL,
          synced_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS playlist_tracks (
          playlist_id TEXT NOT NULL,
          track_id TEXT NOT NULL,
          position INTEGER NOT NULL,
          name TEXT NOT NULL,
          artists TEXT NOT NULL,
          album_name TEXT,
          image_url TEXT,
          duration_ms INTEGER NOT NULL,
          synced_at INTEGER NOT NULL,
          PRIMARY KEY (playlist_id, track_id)
        );

        CREATE TABLE IF NOT EXISTS track_audio_features (
          spotify_track_id TEXT PRIMARY KEY,
          source TEXT NOT NULL,
          tempo REAL NOT NULL,
          valence REAL,
          energy REAL,
          danceability REAL,
          acousticness REAL,
          instrumentalness REAL,
          liveness REAL,
          loudness REAL,
          speechiness REAL,
          fetched_at INTEGER NOT NULL
        );
      `);
      // Migración para instalaciones creadas antes de `selected_for_bpm` (ver PlaylistSelectionScreen).
      await ensureColumn(db, "playlists", "selected_for_bpm", "selected_for_bpm INTEGER NOT NULL DEFAULT 0");
      return db;
    })
      .catch((error) => {
        // Si la apertura/migración falla, no queremos dejar `dbPromise` apuntando a
        // una promesa rechazada para siempre — eso rompería TODA lectura/escritura
        // de SQLite por el resto de la sesión (playlists, liked songs, audio
        // features, todo), sin ninguna forma de recuperarse sin reiniciar la app.
        dbPromise = null;
        throw error;
      });
  }
  return dbPromise;
}
