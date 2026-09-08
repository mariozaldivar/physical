import { useCallback, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, DarkTheme, type Theme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import { LoginScreen } from "./src/screens";
import { MainNavigator } from "./src/navigation/MainNavigator";
import { colors } from "./src/theme/theme";
import type { RootStackParamList } from "./src/navigation/types";

SplashScreen.preventAutoHideAsync().catch(() => {});

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.bg,
    text: colors.ink,
    border: colors.hairline,
    primary: colors.pulseCalm,
  },
};

export default function App() {
  // `fontError` importa especialmente en un build standalone: si la carga de
  // fuentes falla ahí (assets corruptos, poca memoria), sin mirarlo la app se
  // queda en el splash para siempre, sin pantalla y sin error visible. Se
  // prefiere arrancar con la tipografía del sistema antes que no arrancar.
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });
  const fontsSettled = fontsLoaded || Boolean(fontError);

  const onLayoutRootView = useCallback(async () => {
    if (fontsSettled) {
      await SplashScreen.hideAsync();
    }
  }, [fontsSettled]);

  useEffect(() => {
    onLayoutRootView();
  }, [onLayoutRootView]);

  if (!fontsSettled) return null;

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaProvider>
        <View style={styles.backdrop}>
          <View style={styles.phoneFrame}>
            <NavigationContainer theme={navigationTheme}>
              <Stack.Navigator
                initialRouteName="Login"
                screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}
              >
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Home" component={MainNavigator} />
              </Stack.Navigator>
            </NavigationContainer>
            <StatusBar style="light" />
          </View>
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
  },
  // Restringe el ancho a proporciones de teléfono incluso cuando se prueba
  // en un navegador de escritorio ancho.
  phoneFrame: {
    flex: 1,
    width: "100%",
    maxWidth: 480,
  },
});
