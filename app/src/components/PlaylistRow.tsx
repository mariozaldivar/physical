import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts, radii, spacing } from "../theme/theme";
import type { LibraryPlaylist } from "../services/spotifyLibrary";

interface PlaylistRowProps {
  playlist: LibraryPlaylist;
  onToggle: (playlistId: string) => void;
}

function trackCountLabel(count: number): string {
  return count === 1 ? "1 canción" : `${count} canciones`;
}

/**
 * Fila de playlist con checkmark, para PlaylistSelectionScreen. El check usa
 * spotifyGreen (no un acento de zona pulseHot/pulseCalm) porque lo que se
 * marca es contenido de Spotify, no un estado de BPM — mismo criterio que ya
 * usa NowPlayingCard para su fila de atribución.
 */
export function PlaylistRow({ playlist, onToggle }: PlaylistRowProps) {
  const { id, name, ownerName, imageUrl, trackCount, selectedForBpm } = playlist;

  return (
    <Pressable
      onPress={() => onToggle(id)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.art} />
      ) : (
        <View style={[styles.art, styles.artPlaceholder]}>
          <Ionicons name="musical-notes" size={18} color={colors.inkFaint} />
        </View>
      )}

      <View style={styles.meta}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.detail} numberOfLines={1}>
          {ownerName ? `${ownerName} · ` : ""}
          {trackCountLabel(trackCount)}
        </Text>
      </View>

      <View style={[styles.checkmark, selectedForBpm && styles.checkmarkSelected]}>
        {selectedForBpm ? (
          <MaterialCommunityIcons name="check" size={15} color={colors.spotifyBlack} />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
  },
  rowPressed: {
    backgroundColor: colors.surface,
  },
  art: {
    width: 46,
    height: 46,
    borderRadius: radii.sm,
  },
  artPlaceholder: {
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  meta: {
    flex: 1,
  },
  name: {
    fontFamily: fonts.displayMedium,
    color: colors.ink,
    fontSize: 14.5,
  },
  detail: {
    color: colors.inkFaint,
    fontSize: 12,
    marginTop: 2,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  checkmarkSelected: {
    backgroundColor: colors.spotifyGreen,
    borderColor: colors.spotifyGreen,
  },
});
