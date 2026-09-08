import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radii, spacing, zoneColor } from "../theme/theme";
import { MIN_BLOCK_HEIGHT, useScreenSize } from "../theme/layout";
import type { PulseZone, QueueTrack } from "../types/music";

interface NextUpQueueProps {
  queue: QueueTrack[];
  zone: PulseZone;
  /** true mientras se recalcula la cola real (sync de biblioteca o cross-referencing de BPM en curso). */
  isUpdating?: boolean;
}

/**
 * "A continuación" (≈1/5 de pantalla, dejando espacio para la tab bar inferior).
 * La cola se recorre horizontalmente en el orden real de reproducción —
 * la posición izquierda→derecha SÍ es la secuencia, por eso no lleva numeración aparte.
 */
export function NextUpQueue({ queue, zone, isUpdating = false }: NextUpQueueProps) {
  const accent = zoneColor(zone);
  const { width, compact } = useScreenSize();
  // El chip se mide contra la pantalla en vez de llevar un ancho fijo: la idea
  // es que siempre se asome el siguiente (señal de que la fila se desplaza),
  // tanto en un 320dp como en un 412dp.
  const chipWidth = Math.max(148, Math.min(190, (width - spacing.lg * 2) * 0.47));

  return (
    <View style={[styles.section, compact && styles.sectionCompact]}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>A continuación</Text>
        {isUpdating ? (
          <View style={styles.updatingRow}>
            <ActivityIndicator size="small" color={colors.inkFaint} />
            <Text style={styles.updatingText}>Actualizando…</Text>
          </View>
        ) : null}
      </View>

      {queue.length === 0 ? (
        <View style={styles.emptyRow}>
          <Text style={styles.emptyText}>
            Sin coincidencias todavía — Physical está buscando canciones en tu rango de BPM.
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {queue.map((track) => (
            <View key={track.id} style={[styles.chip, { width: chipWidth }]}>
              <View style={styles.thumb}>
                {track.albumArtUrl ? (
                  <Image source={{ uri: track.albumArtUrl }} style={styles.thumbImage} />
                ) : (
                  <Ionicons name="musical-note" size={16} color={colors.inkFaint} />
                )}
              </View>
              <View style={styles.chipMeta}>
                <Text style={styles.chipTitle} numberOfLines={1}>
                  {track.title}
                </Text>
                <Text style={styles.chipArtist} numberOfLines={1}>
                  {track.artist}
                </Text>
                <View style={styles.chipBpmRow}>
                  <View style={[styles.chipDot, { backgroundColor: accent }]} />
                  <Text style={[styles.chipBpm, { color: accent }]}>{Math.round(track.bpm ?? 0)} BPM</Text>
                </View>
                {track.matchReason ? (
                  <Text style={styles.chipReason} numberOfLines={1}>
                    {track.matchReason}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    flex: 1,
    // Piso del bloque: etiqueta + un chip completo. Ver MIN_BLOCK_HEIGHT.
    minHeight: MIN_BLOCK_HEIGHT.queue,
    paddingTop: spacing.lg,
  },
  sectionCompact: {
    paddingTop: spacing.sm,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  label: {
    color: colors.inkMuted,
    fontSize: 13,
  },
  updatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  updatingText: {
    color: colors.inkFaint,
    fontSize: 11,
  },
  row: {
    gap: spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  thumb: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  chipMeta: {
    flex: 1,
  },
  chipTitle: {
    fontFamily: fonts.displayMedium,
    color: colors.ink,
    fontSize: 12.5,
  },
  chipArtist: {
    color: colors.inkFaint,
    fontSize: 11,
    marginTop: 1,
  },
  chipBpmRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  chipDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  chipBpm: {
    fontSize: 10.5,
    fontFamily: fonts.displayMedium,
  },
  chipReason: {
    color: colors.inkFaint,
    fontSize: 10,
    marginTop: 1,
  },
  emptyRow: {
    flex: 1,
    justifyContent: "center",
  },
  emptyText: {
    color: colors.inkFaint,
    fontSize: 12,
  },
});
