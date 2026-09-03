import { Image, StyleSheet, Text, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { StartSessionCard } from "./StartSessionCard";
import { colors, fonts, radii, spacing, zoneColor } from "../theme/theme";
import type { Track, PulseZone } from "../types/music";

function formatTime(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

interface NowPlayingCardProps {
  track: Track | null;
  zone: PulseZone;
  /** true = playback real vía Spotify Web API; false = vista previa con datos de muestra. */
  isLive?: boolean;
  /** Si se pasa, se muestra StartSessionCard (en vez del empty state genérico) cuando `track` es null. */
  onStartSession?: () => void;
}

/**
 * Tarjeta "Now Playing" (≈3/5 de pantalla). Sigue los guidelines de marca de Spotify:
 * fondo negro, verde Spotify reservado para el logo/atribución, arte cuadrado.
 * El BPM de la canción se muestra como dato propio de Physical (acento de zona), no de Spotify.
 */
export function NowPlayingCard({ track, zone, isLive = false, onStartSession }: NowPlayingCardProps) {
  const accent = zoneColor(zone);

  return (
    <View style={styles.card}>
      <View style={styles.attributionRow}>
        <MaterialCommunityIcons name="spotify" size={14} color={colors.spotifyGreen} />
        <Text style={styles.attributionText}>
          {isLive ? "Reproduciendo desde Spotify" : "Vista previa · datos de muestra"}
        </Text>
      </View>

      {track ? (
        <>
          <View style={styles.artRow}>
            {track.albumArtUrl ? (
              <Image source={{ uri: track.albumArtUrl }} style={styles.art} />
            ) : (
              <View style={[styles.art, styles.artPlaceholder, { borderColor: accent }]}>
                <Ionicons name="musical-notes" size={28} color={accent} />
              </View>
            )}
          </View>

          <View style={styles.meta}>
            <Text style={styles.title} numberOfLines={1}>
              {track.title}
            </Text>
            <Text style={styles.artist} numberOfLines={1}>
              {track.artist}
            </Text>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(
                    100,
                    ((track.progressMs ?? 0) / Math.max(track.durationMs, 1)) * 100,
                  )}%`,
                },
              ]}
            />
          </View>
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatTime(track.progressMs ?? 0)}</Text>
            <Text style={styles.timeText}>{formatTime(track.durationMs)}</Text>
          </View>

          {track.bpm !== undefined ? (
            <View style={[styles.bpmBadge, { borderColor: accent }]}>
              <Ionicons name="pulse" size={13} color={accent} />
              <Text style={[styles.bpmBadgeText, { color: accent }]}>{Math.round(track.bpm)} BPM</Text>
            </View>
          ) : (
            <View style={[styles.bpmBadge, styles.bpmBadgeUnknown]}>
              <Text style={styles.bpmBadgeUnknownText}>BPM no disponible</Text>
            </View>
          )}
        </>
      ) : onStartSession ? (
        <StartSessionCard zone={zone} onPress={onStartSession} />
      ) : (
        <View style={styles.empty}>
          <Ionicons name="musical-notes-outline" size={32} color={colors.inkFaint} />
          <Text style={styles.emptyTitle}>Nada sonando</Text>
          <Text style={styles.emptyHint}>Dale play a algo en Spotify para empezar a sincronizar.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 3,
    backgroundColor: colors.spotifyBlack,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  attributionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  attributionText: {
    color: colors.inkMuted,
    fontSize: 12,
  },
  artRow: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
  },
  art: {
    width: "72%",
    aspectRatio: 1,
    borderRadius: radii.sm,
  },
  artPlaceholder: {
    backgroundColor: "#111111",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  meta: {
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 19,
  },
  artist: {
    color: colors.inkMuted,
    fontSize: 14,
    marginTop: 2,
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: "#2A2A2A",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.spotifyGreen,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  timeText: {
    color: colors.inkFaint,
    fontSize: 11,
  },
  bpmBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  bpmBadgeText: {
    fontFamily: fonts.displayMedium,
    fontSize: 12,
  },
  bpmBadgeUnknown: {
    borderColor: colors.hairline,
  },
  bpmBadgeUnknownText: {
    color: colors.inkFaint,
    fontSize: 11.5,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontFamily: fonts.displayMedium,
    color: colors.inkMuted,
    fontSize: 15,
    marginTop: spacing.xs,
  },
  emptyHint: {
    color: colors.inkFaint,
    fontSize: 12,
    textAlign: "center",
  },
});
