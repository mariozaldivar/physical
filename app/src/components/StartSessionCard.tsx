import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radii, spacing, zoneColor } from "../theme/theme";
import type { PulseZone } from "../theme/theme";

interface StartSessionCardProps {
  zone: PulseZone;
  onPress: () => void;
}

/**
 * CTA central de NowPlayingCard cuando la sesión todavía no está corriendo
 * (ver src/INSCTRUCTIONS.md, archivado): conecta la banda y arranca
 * `startSync`, que llena "now playing" + cola con el BPM simulado.
 */
export function StartSessionCard({ zone, onPress }: StartSessionCardProps) {
  const accent = zoneColor(zone);

  return (
    <View style={styles.wrap}>
      <View style={[styles.iconRing, { borderColor: accent }]}>
        <Ionicons name="pulse" size={26} color={accent} />
      </View>
      <Text style={styles.title}>Inicia tu sesión</Text>
      <Text style={styles.subtitle}>
        Conecta tu banda para que Physical arme la cola según tu pulso.
      </Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Conectar banda y empezar sesión"
        style={({ pressed }) => [styles.button, { backgroundColor: accent }, pressed && styles.buttonPressed]}
      >
        <Ionicons name="bluetooth" size={16} color={colors.bg} />
        <Text style={styles.buttonText}>Conectar banda</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  iconRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 17,
  },
  subtitle: {
    color: colors.inkMuted,
    fontSize: 12.5,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 220,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    marginTop: spacing.sm,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    fontFamily: fonts.displayMedium,
    color: colors.bg,
    fontSize: 13.5,
  },
});
