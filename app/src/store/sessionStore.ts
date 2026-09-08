import { create } from "zustand";
import { DEMO_START_BPM, pickNowPlayingForBpm, pickQueueForBpm, randomBpmInZone } from "../data/mockPlayback";
import { usePlayHistoryStore } from "./playHistoryStore";
import { disconnectFromDevice, subscribeToDisconnection, subscribeToHeartRate } from "../services/band";
import type { BandSource, DiscoveredDevice, HeartRateSubscription } from "../services/bleScanner";
import type { PulseZone } from "../theme/theme";
import type { BandConnectionState, QueueTrack, Track } from "../types/music";

/**
 * Cuánto tiene que moverse el BPM real para rearmar las sugerencias
 * simuladas (las que se ven cuando NO hay sesión de Spotify). Sin un umbral,
 * el jitter normal del sensor cambiaría la canción cada segundo. La cola real
 * de Spotify tiene su propio umbral, más conservador, en `spotifyStore.ts`.
 */
const SIMULATED_REFRESH_BPM_DELTA = 5;

/**
 * Suscripciones BLE vivas de la sesión actual. Viven fuera del store a
 * propósito: son handles nativos, no estado serializable, y nada de la UI
 * necesita re-renderizarse cuando cambian.
 */
let heartRateSubscription: HeartRateSubscription | null = null;
let disconnectionSubscription: HeartRateSubscription | null = null;
let connectedDeviceId: string | null = null;

function teardownBandSubscriptions(): void {
  heartRateSubscription?.remove();
  heartRateSubscription = null;
  disconnectionSubscription?.remove();
  disconnectionSubscription = null;
  if (connectedDeviceId) {
    // Ver Planeacion_proyecto.md: "al terminar la sesión, desactivar el sensor
    // de la pulsera". Si ya se cayó sola, este cierre falla y da igual.
    disconnectFromDevice(connectedDeviceId).catch(() => {});
    connectedDeviceId = null;
  }
}

interface SessionState {
  isSyncing: boolean;
  connection: BandConnectionState;
  zone: PulseZone;
  bpm: number;
  /** De dónde viene el BPM: la banda real por BLE, o el flujo simulado sin hardware. */
  source: BandSource;
  /** Nombre de la banda conectada, para poder decirlo en pantalla. */
  bandName: string | null;
  /**
   * Contacto del sensor reportado por la banda. `null` significa que la banda
   * está conectada pero no reporta contacto — que es exactamente lo que manda
   * el firmware cuando el MAX30102 no responde en el bus I2C. Distinguirlo de
   * `false` ("hay sensor, pero no traes la banda puesta") es lo que permite
   * decirle al usuario cuál de los dos problemas tiene.
   */
  sensorContact: boolean | null;
  /** Error de la banda visible en pantalla (BLE caído, permisos, desconexión). */
  bandError: string | null;
  /** Sugerencias simuladas para cuando no hay sesión real de Spotify — ver mockPlayback.ts. */
  nowPlaying: Track | null;
  queue: QueueTrack[];
  setZone: (zone: PulseZone) => void;
  /** Llamar tras un connectToDevice(...) exitoso — BleConnectModal ya mostró el scan/connect. */
  startSync: (device: DiscoveredDevice, source: BandSource) => void;
  stopSync: () => void;
  /** Sólo aplica al flujo simulado: con banda real el BPM llega por notificación BLE. */
  refreshReading: () => void;
}

/**
 * Estado de la sesión de escucha (ver flujo en Planeacion_proyecto.md):
 * iniciar sesión → leer BPM de la banda → elegir canciones en rango → al
 * terminar, desactivar el sensor.
 *
 * El BPM puede venir de dos fuentes (`source`): la banda real por BLE
 * (notificaciones del characteristic 0x2A37, empujadas por `startSync`), o el
 * flujo simulado sin hardware (`refreshReading`, llamado por un intervalo en
 * HomeScreen). El resto de la app no distingue: lee `bpm` y ya.
 */
export const useSessionStore = create<SessionState>((set, get) => ({
  isSyncing: false,
  connection: "disconnected",
  zone: "calm",
  bpm: 0,
  source: "simulated",
  bandName: null,
  sensorContact: null,
  bandError: null,
  nowPlaying: null,
  queue: [],

  setZone: (zone) => {
    set({ zone });
    // En modo banda el BPM lo manda el corazón del usuario, no la zona: cambiar
    // de modo sólo cambia cómo se interpreta esa lectura (ver bpmQueue.ts).
    if (get().connection === "connected" && get().source === "simulated") {
      const bpm = randomBpmInZone(zone);
      const nowPlaying = pickNowPlayingForBpm(bpm);
      usePlayHistoryStore.getState().recordPlayed(nowPlaying.id);
      set({ bpm, nowPlaying, queue: pickQueueForBpm(bpm, nowPlaying.id) });
    }
  },

  startSync: (device, source) => {
    teardownBandSubscriptions();

    if (source === "simulated") {
      const bpm = DEMO_START_BPM[get().zone];
      const nowPlaying = pickNowPlayingForBpm(bpm);
      usePlayHistoryStore.getState().recordPlayed(nowPlaying.id);
      set({
        isSyncing: true,
        connection: "connected",
        source,
        bandName: device.name,
        sensorContact: true,
        bandError: null,
        bpm,
        nowPlaying,
        queue: pickQueueForBpm(bpm, nowPlaying.id),
      });
      return;
    }

    connectedDeviceId = device.id;
    set({
      isSyncing: true,
      connection: "connected",
      source,
      bandName: device.name,
      // Todavía no llegó ninguna notificación: no se sabe si hay sensor.
      sensorContact: null,
      bandError: null,
      bpm: 0,
      nowPlaying: null,
      queue: [],
    });

    heartRateSubscription = subscribeToHeartRate(
      device.id,
      ({ bpm, sensorContactDetected }) => {
        const previous = get();
        if (!previous.isSyncing) return;

        set({ bpm, sensorContact: sensorContactDetected, bandError: null });

        // Las sugerencias simuladas sólo se ven sin sesión de Spotify, pero
        // mantenerlas al día cuesta nada (pool chico, operaciones puras) y
        // evita que esa pantalla se quede clavada en la primera lectura.
        if (bpm > 0 && Math.abs(bpm - previous.bpm) >= SIMULATED_REFRESH_BPM_DELTA) {
          const nowPlaying = pickNowPlayingForBpm(bpm);
          usePlayHistoryStore.getState().recordPlayed(nowPlaying.id);
          set({ nowPlaying, queue: pickQueueForBpm(bpm, nowPlaying.id) });
        }
      },
      (error) => set({ bandError: error.message }),
    );

    disconnectionSubscription = subscribeToDisconnection(device.id, () => {
      if (!get().isSyncing) return;
      teardownBandSubscriptions();
      set({
        isSyncing: false,
        connection: "disconnected",
        bpm: 0,
        sensorContact: null,
        bandError: "Se perdió la conexión con la banda. Revisa que esté encendida y cerca.",
      });
    });
  },

  stopSync: () => {
    teardownBandSubscriptions();
    set({
      isSyncing: false,
      connection: "disconnected",
      bpm: 0,
      bandName: null,
      sensorContact: null,
      bandError: null,
      nowPlaying: null,
      queue: [],
    });
  },

  refreshReading: () => {
    const { connection, source, zone } = get();
    if (connection !== "connected" || source !== "simulated") return;
    set({ bpm: randomBpmInZone(zone) });
  },
}));
