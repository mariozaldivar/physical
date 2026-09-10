import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { DrawerActions } from "@react-navigation/native";
import type { DrawerScreenProps } from "@react-navigation/drawer";
import { BleConnectModal, BpmMonitorBar, NextUpQueue, NowPlayingCard } from "../components";
import type { MainDrawerParamList } from "../navigation/types";
import { useSessionStore } from "../store/sessionStore";
import { useSpotifyStore } from "../store/spotifyStore";
import { colors, fonts, radii, spacing, zoneColor } from "../theme/theme";
import type { PulseZone } from "../theme/theme";

type Props = DrawerScreenProps<MainDrawerParamList, "Home">;

const ZONE_LABEL: Record<PulseZone, string> = {
  calm: "Estudio",
  hot: "Ejercicio",
};

const READING_INTERVAL_MS = 2500;
const NOW_PLAYING_POLL_MS = 5000;
// Cada cuánto se contrasta el modelo local de la cola contra la cola real de
// Spotify — ver QUEUE_MODEL_SYNC_MS en store/spotifyStore.ts (deben ir de la mano).
const QUEUE_MODEL_POLL_MS = 30000;

export function HomeScreen({ navigation }: Props) {
  const {
    isSyncing,
    connection,
    zone,
    bpm,
    source,
    sensorContact,
    bandError,
    nowPlaying: simulatedNowPlaying,
    queue: simulatedQueue,
    setZone,
    startSync,
    stopSync,
    refreshReading,
  } = useSessionStore();
  const [bleModalVisible, setBleModalVisible] = useState(false);

  const spotifySession = useSpotifyStore((state) => state.session);
  const spotifyNowPlaying = useSpotifyStore((state) => state.nowPlaying);
  const spotifyQueue = useSpotifyStore((state) => state.queue);
  const queueError = useSpotifyStore((state) => state.queueError);
  const queueBuilding = useSpotifyStore((state) => state.queueBuilding);
  const librarySyncing = useSpotifyStore((state) => state.librarySyncing);
  const lastAutoQueuedTracks = useSpotifyStore((state) => state.lastAutoQueuedTracks);
  const loadCachedLibrary = useSpotifyStore((state) => state.loadCachedLibrary);
  const syncLibrary = useSpotifyStore((state) => state.syncLibrary);
  const refreshNowPlaying = useSpotifyStore((state) => state.refreshNowPlaying);
  const refreshQueueForBpm = useSpotifyStore((state) => state.refreshQueueForBpm);
  const syncQueueModel = useSpotifyStore((state) => state.syncQueueModel);
  const clearQueue = useSpotifyStore((state) => state.clearQueue);

  // Sólo el flujo simulado necesita este intervalo: con banda real el BPM llega
  // empujado por las notificaciones BLE del characteristic 0x2A37, y este
  // timer las pisaría con valores inventados.
  useEffect(() => {
    if (connection !== "connected" || source !== "simulated") return;
    const id = setInterval(refreshReading, READING_INTERVAL_MS);
    return () => clearInterval(id);
  }, [connection, source, refreshReading]);

  // Cache local primero (offline-first), luego sync fresco si hay sesión real de Spotify.
  useEffect(() => {
    loadCachedLibrary();
  }, [loadCachedLibrary]);

  useEffect(() => {
    if (!spotifySession) return;
    syncLibrary().then(() => {
      // Carrera posible: el usuario conecta la banda (BLE modal, unos pocos
      // segundos) antes de que termine este primer sync de una librería
      // grande — refreshQueueForBpm ya se habrá ejecutado una vez con la cola
      // vacía y `lastQueueBpm` fijado, así que sin `force` no se recalcula
      // hasta que el BPM se mueva lo suficiente por su cuenta. Se leen los
      // valores más frescos directo del store (no del closure de este
      // efecto) porque `syncLibrary` puede tardar más que un render.
      const { connection: currentConnection, bpm: currentBpm } = useSessionStore.getState();
      if (currentConnection !== "connected") return;
      const currentNowPlayingId = useSpotifyStore.getState().nowPlaying?.track.id;
      refreshQueueForBpm(currentBpm, currentNowPlayingId, true);
    });
  }, [spotifySession, syncLibrary, refreshQueueForBpm]);

  // Playback en vivo: solo aplica con sesión real de Spotify (no es parte del mock de BPM).
  useEffect(() => {
    if (!spotifySession) return;
    refreshNowPlaying();
    const id = setInterval(refreshNowPlaying, NOW_PLAYING_POLL_MS);
    return () => clearInterval(id);
  }, [spotifySession, refreshNowPlaying]);

  // Monitoreo de la cola real de Spotify — independiente de los cambios de
  // BPM, para podar del modelo local lo que Physical encoló y ya sonó o el
  // usuario ya sacó de la cola (ver syncQueueModel/QUEUE_MODEL_SYNC_MS en
  // spotifyStore.ts). No hace nada mientras Physical no haya encolado algo.
  useEffect(() => {
    if (!spotifySession) return;
    syncQueueModel();
    const id = setInterval(syncQueueModel, QUEUE_MODEL_POLL_MS);
    return () => clearInterval(id);
  }, [spotifySession, syncQueueModel]);

  const accent = zoneColor(zone);
  const nowPlayingTrack = spotifySession ? (spotifyNowPlaying?.track ?? null) : simulatedNowPlaying;
  // BpmMonitorBar ya sabe pintar un estado "scanning" (punto naranja, "Buscando
  // banda…") que sessionStore nunca fija por sí solo — salta directo de
  // disconnected a connected. Se deriva acá, sin tocar el store: mientras el
  // modal BLE está abierto y todavía no hay conexión, la barra de fondo refleja
  // lo mismo que ya se ve en el modal.
  const displayConnection = bleModalVisible && connection === "disconnected" ? "scanning" : connection;

  // Rearma la cola real (Liked Songs + playlists seleccionadas) cada vez que
  // cambia el BPM leído — refreshQueueForBpm ya hace no-op si el cambio no es
  // significativo, así que este efecto puede correr en cada tick sin problema.
  useEffect(() => {
    if (!spotifySession || connection !== "connected") return;
    refreshQueueForBpm(bpm, nowPlayingTrack?.id);
  }, [spotifySession, connection, bpm, nowPlayingTrack?.id, refreshQueueForBpm]);

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View style={styles.wordmarkRow}>
          <Text style={styles.wordmark}>Physical</Text>
          <Pressable
            onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Elegir playlists para BPM"
            style={styles.playlistsButton}
          >
            <Ionicons name="albums-outline" size={18} color={colors.inkMuted} />
          </Pressable>
        </View>

        <View style={styles.headerActions}>
          <View style={styles.zoneToggle}>
            {(["calm", "hot"] as const).map((option) => {
              const selected = option === zone;
              return (
                <Pressable
                  key={option}
                  onPress={() => setZone(option)}
                  accessibilityRole="button"
                  accessibilityLabel={`Modo ${ZONE_LABEL[option]}`}
                  accessibilityState={{ selected }}
                  style={[
                    styles.zoneOption,
                    selected && { backgroundColor: zoneColor(option) },
                  ]}
                >
                  <Text
                    style={[
                      styles.zoneOptionText,
                      selected && styles.zoneOptionTextSelected,
                    ]}
                  >
                    {ZONE_LABEL[option]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => {
              if (isSyncing) {
                stopSync();
                clearQueue();
              } else {
                setBleModalVisible(true);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={isSyncing ? "Detener sesión" : "Conectar banda y empezar sesión"}
            style={[
              styles.syncButton,
              isSyncing ? { borderColor: accent } : { backgroundColor: accent, borderColor: accent },
            ]}
          >
            <Ionicons
              name={isSyncing ? "stop" : "play"}
              size={14}
              color={isSyncing ? accent : colors.bg}
            />
            <Text style={[styles.syncButtonText, isSyncing ? { color: accent } : { color: colors.bg }]}>
              {isSyncing ? "Detener" : "Conectar banda"}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.stack}>
        <BpmMonitorBar reading={{ bpm, zone, connection: displayConnection, sensorContact }} />
        <NowPlayingCard
          track={nowPlayingTrack}
          zone={zone}
          isLive={Boolean(spotifySession)}
          onStartSession={connection !== "connected" ? () => setBleModalVisible(true) : undefined}
        />
        <NextUpQueue
          queue={spotifySession ? spotifyQueue : simulatedQueue}
          zone={zone}
          isUpdating={Boolean(spotifySession) && (queueBuilding || (connection === "connected" && librarySyncing))}
        />
        {spotifySession && lastAutoQueuedTracks.length > 0 ? (
          <View style={[styles.statusChip, styles.statusChipSuccess]}>
            <Ionicons name="checkmark-circle" size={14} color={colors.spotifyGreen} />
            <Text style={styles.statusChipText} numberOfLines={1}>
              {lastAutoQueuedTracks.length === 1
                ? `“${lastAutoQueuedTracks[0].title}” se agregó a tu cola de Spotify`
                : `${lastAutoQueuedTracks.length} canciones se agregaron a tu cola de Spotify`}
            </Text>
          </View>
        ) : null}
        {bandError ? (
          <View style={[styles.statusChip, styles.statusChipError]}>
            <Ionicons name="bluetooth" size={14} color={colors.pulseHot} />
            <Text style={[styles.statusChipText, styles.statusChipTextError]} numberOfLines={3}>
              {bandError}
            </Text>
          </View>
        ) : null}
        {spotifySession && queueError ? (
          <View style={[styles.statusChip, styles.statusChipError]}>
            <Ionicons name="alert-circle" size={14} color={colors.pulseHot} />
            <Text style={[styles.statusChipText, styles.statusChipTextError]} numberOfLines={3}>
              {queueError}
            </Text>
          </View>
        ) : null}
      </View>

      <BleConnectModal
        visible={bleModalVisible}
        onClose={() => setBleModalVisible(false)}
        onConnected={(device, connectedSource) => {
          setBleModalVisible(false);
          startSync(device, connectedSource);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
  },
  header: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  wordmarkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  wordmark: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 22,
  },
  playlistsButton: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  zoneToggle: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    padding: 3,
  },
  zoneOption: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
  },
  zoneOptionText: {
    fontSize: 12.5,
    color: colors.inkMuted,
    fontFamily: fonts.displayMedium,
  },
  zoneOptionTextSelected: {
    color: colors.bg,
  },
  syncButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  syncButtonText: {
    fontSize: 12.5,
    color: colors.ink,
    fontFamily: fonts.displayMedium,
  },
  stack: {
    flex: 1,
    gap: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: -spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  statusChipSuccess: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.hairline,
  },
  statusChipError: {
    backgroundColor: colors.pulseHotDim,
    borderColor: colors.pulseHot,
  },
  statusChipText: {
    color: colors.inkMuted,
    fontSize: 11.5,
    flexShrink: 1,
  },
  statusChipTextError: {
    color: colors.ink,
  },
});
