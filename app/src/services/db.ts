import { deleteDatabaseAsync, openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

const DB_NAME = "physical.db";

/**
 * SQLite tira estos mensajes cuando el archivo quedó corrupto (típicamente por
 * un apagado forzado a mitad de una escritura) — sin esto, `getDb()` reintenta
 * abrir el mismo archivo roto para siempre y ninguna feature con cache local
 * vuelve a funcionar sin que el usuario reinstale la app.
 */
function isCorruptionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /database disk image is malformed|file is not a database/i.test(error.message);
}

/**
 * Sólo pasa en web: expo-sqlite guarda el archivo vía OPFS, que exige un lock
 * exclusivo por origen. Si otra pestaña (u otro Worker que el navegador no
 * terminó de cerrar todavía) ya tiene ese lock, el intento de abrirlo acá
 * tira `NoModificationAllowedError` o, si esa apertura fallida deja el wasm
 * de SQLite a medio inicializar dentro del Worker, `Invalid VFS state` en
 * cada intento siguiente — verificado contra el propio código de
 * expo-sqlite (`web/worker.ts`, `maybeInitAsync`): una vez que falla ahí, no
 * reintenta la VFS, así que el Worker queda roto hasta recargar la página
 * entera. Recrear el archivo (como con `isCorruptionError`) no sirve acá —
 * el problema es el lock, no el contenido — así que sólo se distingue para
 * dar un mensaje accionable en vez del error crudo del wasm.
 */
function isStorageLockError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /NoModificationAllowedError|Invalid VFS state/i.test(error.message);
}

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

async function openAndMigrate(): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync(DB_NAME);
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
}

export function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openAndMigrate()
      .catch(async (error) => {
        if (isStorageLockError(error)) {
          throw new Error(
            "El almacenamiento local está bloqueado por otra pestaña (u otra sesión de esta app) abierta en el navegador — cerrá esas pestañas y recargá la página para volver a sincronizar tu biblioteca de Spotify.",
          );
        }
        // Un apagado forzado a mitad de una escritura puede dejar el archivo
        // corrupto — SQLite lo reporta como "malformed" o "file is not a
        // database". Sin recrearlo acá, cada intento futuro vuelve a abrir el
        // mismo archivo roto y falla igual para siempre (nada de playlists,
        // liked songs ni audio features vuelve a funcionar sin reinstalar).
        if (!isCorruptionError(error)) throw error;
        await deleteDatabaseAsync(DB_NAME);
        return openAndMigrate();
      })
      .catch((error) => {
        // Si la apertura/migración sigue fallando (o falla por otra razón que
        // no es corrupción), no queremos dejar `dbPromise` apuntando a una
        // promesa rechazada para siempre — eso rompería TODA lectura/escritura
        // de SQLite por el resto de la sesión, sin ninguna forma de
        // recuperarse sin reiniciar la app.
        dbPromise = null;
        throw error;
      });
  }
  return dbPromise;
}
