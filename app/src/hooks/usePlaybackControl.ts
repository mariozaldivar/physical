import { useCallback, useState } from "react";
import { useSpotifyStore } from "../store/spotifyStore";
import {
  addToQueue,
  getAvailableDevices,
  getQueue,
  pausePlayback,
  resumePlayback,
  seekToPosition,
  skipToNext,
  skipToPrevious,
  transferPlayback,
  type PlaybackQueue,
  type ResumePlaybackOptions,
  type SpotifyDevice,
} from "../services/spotifyPlaybackControl";

/**
 * Wrapper de React sobre spotifyPlaybackControl.ts: toma el access token de la
 * sesión activa (spotifyStore) para que quien llame no tenga que pasarlo cada
 * vez, y expone `loading`/`error` para poder deshabilitar botones o mostrar
 * feedback en la UI mientras implementen las pantallas de control de playback.
 *
 * Nadie dispara estas acciones automáticamente todavía — el sistema de BPM
 * (que decidiría cuándo hacer skip o qué encolar) no existe aún. Este hook es
 * la plomería que ese sistema va a usar.
 */
export function usePlaybackControl() {
  const accessToken = useSpotifyStore((state) => state.session?.accessToken);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async <T,>(action: (token: string) => Promise<T>): Promise<T | undefined> => {
      if (!accessToken) {
        setError("No hay sesión de Spotify activa.");
        return undefined;
      }
      setLoading(true);
      setError(null);
      try {
        return await action(accessToken);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo controlar el playback de Spotify.");
        return undefined;
      } finally {
        setLoading(false);
      }
    },
    [accessToken],
  );

  return {
    loading,
    error,
    listDevices: useCallback((): Promise<SpotifyDevice[] | undefined> => run(getAvailableDevices), [run]),
    transferToDevice: useCallback(
      (deviceId: string, play?: boolean) => run((token) => transferPlayback(token, deviceId, play)),
      [run],
    ),
    play: useCallback(
      (options?: ResumePlaybackOptions) => run((token) => resumePlayback(token, options)),
      [run],
    ),
    pause: useCallback(() => run((token) => pausePlayback(token)), [run]),
    next: useCallback(() => run((token) => skipToNext(token)), [run]),
    previous: useCallback(() => run((token) => skipToPrevious(token)), [run]),
    seekTo: useCallback((positionMs: number) => run((token) => seekToPosition(token, positionMs)), [run]),
    addToQueue: useCallback((trackUri: string) => run((token) => addToQueue(token, trackUri)), [run]),
    getQueue: useCallback((): Promise<PlaybackQueue | undefined> => run(getQueue), [run]),
  };
}
