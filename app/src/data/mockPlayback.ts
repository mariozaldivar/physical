import type { PulseZone } from "../theme/theme";
import type { QueueTrack, Track } from "../types/music";
import { bpmMatchReason, sortByBpmDistance } from "../utils/bpmMatch";

/**
 * Datos de muestra para poder demostrar la UI sin depender todavía del
 * cross-referencing real de BPM (ver Stack_tecnico_proyecto.md, sección 7,
 * y TODO_apis_bpm.md — las fuentes de BPM aún no tienen credenciales).
 *
 * Simula lo que en producción sería "las canciones guardadas del usuario +
 * su BPM ya resuelto vía ReccoBeats" (ver Planeacion_proyecto.md): un pool
 * plano de tracks con BPM conocido, del que se arma la cola según la lectura
 * de la banda — no un queue fijo por zona.
 */
export const MOCK_TRACK_POOL: Track[] = [
  { id: "cafe-frio", title: "Café Frío", artist: "Bajo Marea", bpm: 61, durationMs: 214_000 },
  { id: "concentracion", title: "Concentración", artist: "Bajo Marea", bpm: 64, durationMs: 232_000 },
  { id: "hoja-en-blanco", title: "Hoja en Blanco", artist: "Bajo Marea", bpm: 68, durationMs: 245_000 },
  { id: "pagina-47", title: "Página 47", artist: "Cuarto Silencioso", bpm: 70, durationMs: 201_000 },
  { id: "marea-baja", title: "Marea Baja", artist: "Cuarto Silencioso", bpm: 74, durationMs: 223_000 },
  { id: "paso-firme", title: "Paso Firme", artist: "Rayo Sur", bpm: 114, durationMs: 196_000 },
  { id: "zancada", title: "Zancada", artist: "Nova Circuito", bpm: 118, durationMs: 188_000 },
  { id: "ritmo-constante", title: "Ritmo Constante", artist: "Alta Tensión", bpm: 122, durationMs: 205_000 },
  { id: "segunda-vuelta", title: "Segunda Vuelta", artist: "Nova Circuito", bpm: 126, durationMs: 199_000 },
  { id: "segundo-aire", title: "Segundo Aire", artist: "Alta Tensión", bpm: 146, durationMs: 189_000 },
  { id: "correr-sin-freno", title: "Correr Sin Freno", artist: "Alta Tensión", bpm: 148, durationMs: 192_000 },
  { id: "pulso-electrico", title: "Pulso Eléctrico", artist: "Nova Circuito", bpm: 150, durationMs: 198_000 },
  { id: "motor-a-fondo", title: "Motor a Fondo", artist: "Rayo Sur", bpm: 154, durationMs: 210_000 },
];

/** Rango de BPM simulado que reporta la banda por zona (jitter de `refreshReading`). */
const ZONE_BPM_RANGE: Record<PulseZone, [number, number]> = {
  hot: [120, 158],
  calm: [58, 78],
};

/**
 * BPM con el que arranca la demo al iniciar sesión — pedido explícitamente
 * para poder probar el flujo de forma reproducible ("intenta con un BPM de
 * 120, simulando a alguien haciendo ejercicio"). Después de arrancar, la
 * lectura sigue jitteando dentro de `ZONE_BPM_RANGE` vía `randomBpmInZone`.
 */
export const DEMO_START_BPM: Record<PulseZone, number> = {
  hot: 120,
  calm: 66,
};

export function randomBpmInZone(zone: PulseZone): number {
  const [min, max] = ZONE_BPM_RANGE[zone];
  return Math.round(min + Math.random() * (max - min));
}

/** El track del pool más cercano al BPM objetivo — para "now playing" al iniciar sesión. */
export function pickNowPlayingForBpm(targetBpm: number): Track {
  const [closest] = sortByBpmDistance(MOCK_TRACK_POOL, targetBpm);
  return { ...closest, progressMs: 0 };
}

/**
 * Arma la cola: los `count` tracks del pool más cercanos al BPM objetivo,
 * excluyendo el que ya está sonando, con `matchReason` explicando por qué
 * cada uno entró (mismo criterio de "rango de BPM" que describe
 * Planeacion_proyecto.md). Mismo criterio que usa el flujo real con Spotify
 * — ver `services/bpmQueue.ts`.
 */
export function pickQueueForBpm(targetBpm: number, excludeTrackId?: string, count = 3): QueueTrack[] {
  return sortByBpmDistance(
    MOCK_TRACK_POOL.filter((track) => track.id !== excludeTrackId),
    targetBpm,
  )
    .slice(0, count)
    .map((track) => ({ ...track, matchReason: bpmMatchReason(track.bpm ?? targetBpm, targetBpm) }));
}
