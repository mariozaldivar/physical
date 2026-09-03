import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts, radii, spacing } from "../theme/theme";

interface SpotifyLoginButtonProps {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  label?: string;
}

/**
 * Botón de login con Spotify. Fondo negro + logo verde oficial + texto blanco,
 * siguiendo los brand guidelines de Spotify para botones de conexión de terceros.
 */
export function SpotifyLoginButton({
  onPress,
  loading = false,
  disabled = false,
  label = "Continuar con Spotify",
}: SpotifyLoginButtonProps) {
  const isInactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isInactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.button,
        isInactive && styles.buttonDisabled,
        pressed && !isInactive && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.ink} />
      ) : (
        <MaterialCommunityIcons name="spotify" size={20} color={colors.spotifyGreen} />
      )}
      <Text style={styles.label}>{loading ? "Conectando…" : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.spotifyBlack,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    minHeight: 52,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  label: {
    fontFamily: fonts.displayMedium,
    color: colors.ink,
    fontSize: 15,
  },
});
