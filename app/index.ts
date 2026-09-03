// Debe ser el primer import del entry point (requisito de react-native-gesture-handler,
// que usa el Drawer del menú de playlists — ver src/screens/PlaylistSelectionScreen.tsx).
import 'react-native-gesture-handler';

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
