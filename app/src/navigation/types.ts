export type RootStackParamList = {
  Login: undefined;
  /** Renderiza MainNavigator (Drawer): Home + el panel de PlaylistSelection. */
  Home: undefined;
};

/**
 * Drawer interno post-login. Sólo tiene una Drawer.Screen registrada (Home) —
 * PlaylistSelection no es una pantalla de navegación normal, es el contenido
 * custom del panel del drawer (ver navigation/MainNavigator.tsx), así que no
 * necesita su propia entrada aquí para poder recibir `navigation`/`route`.
 */
export type MainDrawerParamList = {
  Home: undefined;
};
