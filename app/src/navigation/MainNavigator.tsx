import { createDrawerNavigator } from "@react-navigation/drawer";
import { HomeScreen } from "../screens/HomeScreen";
import { PlaylistSelectionScreen } from "../screens/PlaylistSelectionScreen";
import { colors } from "../theme/theme";
import type { MainDrawerParamList } from "./types";

const Drawer = createDrawerNavigator<MainDrawerParamList>();

/**
 * Drawer post-login (ver instructions_archive/components_playlist_selection_INSTRUCTIONS.md).
 * El panel de playlists vive a la derecha y se abre deslizando el dedo hacia la
 * izquierda — `drawerPosition: "right"` es lo que invierte el gesto por
 * defecto de React Navigation (que abre deslizando hacia la derecha para un
 * drawer a la izquierda). El contenido del panel es la pantalla completa de
 * selección, no una lista de navegación — por eso `drawerContent` reemplaza
 * al menú default en vez de registrar PlaylistSelection como Drawer.Screen.
 */
export function MainNavigator() {
  return (
    <Drawer.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        drawerPosition: "right",
        drawerType: "front",
        drawerStyle: { width: "85%", backgroundColor: colors.bg },
        overlayColor: "rgba(0,0,0,0.55)",
        swipeEdgeWidth: 60,
      }}
      drawerContent={(props) => <PlaylistSelectionScreen {...props} />}
    >
      <Drawer.Screen name="Home" component={HomeScreen} />
    </Drawer.Navigator>
  );
}
