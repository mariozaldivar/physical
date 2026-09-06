import { useMemo } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { DrawerActions } from "@react-navigation/native";
import type { DrawerContentComponentProps } from "@react-navigation/drawer";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { PlaylistRow } from "../components/PlaylistRow";
import { useSpotifyStore } from "../store/spotifyStore";
import { colors, fonts, spacing } from "../theme/theme";
import type { RootStackParamList } from "../navigation/types";

/**
 * Contenido del panel del drawer (ver navigation/MainNavigator.tsx) — no es una
 * Drawer.Screen registrada, así que recibe `navigation` directo como prop en vez
 * de por hook, pero `useNavigation()` también funcionaría dentro del árbol.
 */
export function PlaylistSelectionScreen({ navigation }: Partial<DrawerContentComponentProps>) {
  const session = useSpotifyStore((state) => state.session);
  const playlists = useSpotifyStore((state) => state.playlists);
  const librarySyncing = useSpotifyStore((state) => state.librarySyncing);
  const libraryError = useSpotifyStore((state) => state.libraryError);
  const syncLibrary = useSpotifyStore((state) => state.syncLibrary);
  const togglePlaylistSelection = useSpotifyStore((state) => state.togglePlaylistSelection);
  const signOut = useSpotifyStore((state) => state.signOut);

  const selectedCount = useMemo(
    () => playlists.filter((playlist) => playlist.selectedForBpm).length,
    [playlists],
  );

  function close() {
    navigation?.dispatch(DrawerActions.closeDrawer());
  }

  async function handleSignOut() {
    await signOut();
    // El drawer vive dentro de MainNavigator, que a su vez es la screen "Home"
    // del Stack raíz — hay que subir un nivel para volver a Login.
    navigation?.getParent<NativeStackNavigationProp<RootStackParamList>>()?.replace("Login");
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom", "right"]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Playlists para BPM</Text>
          <Text style={styles.subtitle}>
            Elige de qué playlists saca Physical las canciones que sugiere según tu pulso.
          </Text>
        </View>
        <Pressable
          onPress={close}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          style={styles.closeButton}
        >
          <Ionicons name="close" size={20} color={colors.inkMuted} />
        </Pressable>
      </View>

      {!session ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            Conecta tu cuenta de Spotify para ver tus playlists aquí.
          </Text>
        </View>
      ) : playlists.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {libraryError
              ? libraryError
              : librarySyncing
                ? "Sincronizando tu biblioteca de Spotify…"
                : "Todavía no hay playlists sincronizadas."}
          </Text>
          {!librarySyncing ? (
            <Pressable
              onPress={() => syncLibrary()}
              accessibilityRole="button"
              accessibilityLabel={libraryError ? "Reintentar sincronización" : "Sincronizar ahora"}
              style={styles.retryButton}
            >
              <Ionicons name="refresh" size={14} color={colors.inkMuted} />
              <Text style={styles.retryButtonText}>
                {libraryError ? "Reintentar" : "Sincronizar ahora"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <>
          <View style={styles.countRow}>
            <Text style={styles.countLabel}>
              {selectedCount === 0
                ? "Ninguna seleccionada todavía"
                : selectedCount === 1
                  ? "1 playlist seleccionada"
                  : `${selectedCount} playlists seleccionadas`}
            </Text>
            {librarySyncing ? (
              <View style={styles.syncingRow}>
                <ActivityIndicator size="small" color={colors.inkFaint} />
                <Text style={styles.syncingText}>Sincronizando…</Text>
              </View>
            ) : null}
          </View>
          <FlatList
            data={playlists}
            keyExtractor={(playlist) => playlist.id}
            renderItem={({ item }) => (
              <PlaylistRow playlist={item} onToggle={togglePlaylistSelection} />
            )}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}

      {session ? (
        <View style={styles.footer}>
          <Pressable
            onPress={handleSignOut}
            accessibilityRole="button"
            accessibilityLabel="Cerrar sesión de Spotify"
            style={styles.signOutButton}
          >
            <Ionicons name="log-out-outline" size={14} color={colors.inkFaint} />
            <Text style={styles.signOutText}>Cerrar sesión de Spotify</Text>
          </Pressable>
          <Text style={styles.footerHint}>
            Si acabas de actualizar la app y el control de playback no responde, cerrar
            sesión y volver a entrar renueva los permisos que Spotify te pide.
          </Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 19,
  },
  subtitle: {
    color: colors.inkMuted,
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: spacing.xs,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xs,
  },
  countLabel: {
    color: colors.inkFaint,
    fontSize: 11.5,
  },
  syncingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  syncingText: {
    color: colors.inkFaint,
    fontSize: 11,
  },
  list: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xxl,
  },
  emptyText: {
    color: colors.inkFaint,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  retryButtonText: {
    color: colors.inkMuted,
    fontFamily: fonts.displayMedium,
    fontSize: 12.5,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  signOutText: {
    color: colors.inkFaint,
    fontFamily: fonts.displayMedium,
    fontSize: 12.5,
  },
  footerHint: {
    color: colors.inkFaint,
    fontSize: 10.5,
    lineHeight: 14,
  },
});
