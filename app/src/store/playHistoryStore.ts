import { create } from "zustand";

/**
 * Cuántas canciones recuerda por defecto — el número "configurable" que pide
 * la instrucción. Cambiarlo acá alcanza para toda la app (real y simulada);
 * también se puede pisar por llamada con el segundo argumento de `recordPlayed`.
 * Documentado en Stack_tecnico_proyecto.md §7.
 */
export const DEFAULT_PLAY_HISTORY_SIZE = 10;

interface PlayHistoryState {
  /** IDs de Spotify (o del pool simulado), más reciente primero. Acotado al límite configurado. */
  recentTrackIds: string[];
  /**
   * Registra un track como recién reproducido/encolado — lo mueve al frente
   * si ya estaba (sin duplicarlo) y recorta al límite. Compartido entre el
   * flujo real (spotifyStore) y el simulado (sessionStore) a propósito: es
   * "lo que Physical ya te puso", sin importar la fuente.
   */
  recordPlayed: (trackId: string, limit?: number) => void;
  reset: () => void;
}

export const usePlayHistoryStore = create<PlayHistoryState>((set, get) => ({
  recentTrackIds: [],

  recordPlayed: (trackId, limit = DEFAULT_PLAY_HISTORY_SIZE) => {
    const withoutDupe = get().recentTrackIds.filter((id) => id !== trackId);
    set({ recentTrackIds: [trackId, ...withoutDupe].slice(0, limit) });
  },

  reset: () => set({ recentTrackIds: [] }),
}));
