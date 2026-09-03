import { create } from "zustand";
import { DEMO_START_BPM, pickNowPlayingForBpm, pickQueueForBpm, randomBpmInZone } from "../data/mockPlayback";
import type { PulseZone } from "../theme/theme";
import type { BandConnectionState, QueueTrack, Track } from "../types/music";

interface SessionState {
  isSyncing: boolean;
  connection: BandConnectionState;
  zone: PulseZone;
  bpm: number;
  /** Sugerencias simuladas para cuando no hay sesión real de Spotify — ver mockPlayback.ts. */
  nowPlaying: Track | null;
  queue: QueueTrack[];
  setZone: (zone: PulseZone) => void;
  /** Llamar tras un connectToDevice(...) exitoso — BleConnectModal ya mostró el scan/connect. */
  startSync: () => void;
  stopSync: () => void;
  refreshReading: () => void;
}

/**
 * Estado de la sesión de escucha (ver flujo en Planeacion_proyecto.md):
 * iniciar sesión → leer BPM de la banda → elegir canciones en rango → al
 * terminar, desactivar el sensor. La lectura real de la banda (BLE) y el
 * cross-referencing real contra Spotify son trabajo de otra tarea; aquí se
 * simula con datos de muestra (mockPlayback.ts) para poder demostrar el
 * flujo end-to-end: iniciar sesión con un BPM de arranque, y armar "now
 * playing" + cola con los tracks del pool simulado más cercanos a ese BPM.
 */
export const useSessionStore = create<SessionState>((set, get) => ({
  isSyncing: false,
  connection: "disconnected",
  zone: "calm",
  bpm: 0,
  nowPlaying: null,
  queue: [],

  setZone: (zone) => {
    set({ zone });
    if (get().connection === "connected") {
      const bpm = randomBpmInZone(zone);
      const nowPlaying = pickNowPlayingForBpm(bpm);
      set({ bpm, nowPlaying, queue: pickQueueForBpm(bpm, nowPlaying.id) });
    }
  },

  startSync: () => {
    const bpm = DEMO_START_BPM[get().zone];
    const nowPlaying = pickNowPlayingForBpm(bpm);
    set({
      isSyncing: true,
      connection: "connected",
      bpm,
      nowPlaying,
      queue: pickQueueForBpm(bpm, nowPlaying.id),
    });
  },

  stopSync: () => set({ isSyncing: false, connection: "disconnected", bpm: 0, nowPlaying: null, queue: [] }),

  refreshReading: () => {
    if (get().connection !== "connected") return;
    set({ bpm: randomBpmInZone(get().zone) });
  },
}));
