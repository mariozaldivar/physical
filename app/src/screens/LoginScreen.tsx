import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SpotifyLoginButton } from "../components";
import { completeWebLoginIfRedirected, getSession, loginWithSpotify } from "../services/spotifyAuth";
import { useSpotifyStore } from "../store/spotifyStore";
import { colors, fonts, spacing } from "../theme/theme";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

const BAR_COUNT = 9;

/** Ola de pulso animada — el mismo motivo ECG/waveform que el corazón de Home, aquí en reposo. */
function PulseWaveform() {
  const bars = useRef(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    const loops = bars.map((bar, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 90),
          Animated.timing(bar, {
            toValue: 1,
            duration: 560,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(bar, {
            toValue: 0,
            duration: 560,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [bars]);

  return (
    <View style={styles.waveform}>
      {bars.map((bar, index) => (
        <Animated.View
          key={index}
          style={[
            styles.waveformBar,
            {
              transform: [
                {
                  scaleY: bar.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

export function LoginScreen({ navigation }: Props) {
  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setSpotifySession = useSpotifyStore((state) => state.setSession);

  useEffect(() => {
    let cancelled = false;

    async function resolveInitialSession() {
      try {
        const redirected = await completeWebLoginIfRedirected();
        if (redirected) {
          if (!cancelled) {
            setSpotifySession(redirected);
            navigation.replace("Home");
          }
          return;
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudo completar el inicio de sesión con Spotify.");
        }
      }

      const session = await getSession();
      if (!cancelled && session) {
        setSpotifySession(session);
        navigation.replace("Home");
        return;
      }
      if (!cancelled) setCheckingSession(false);
    }

    resolveInitialSession();
    return () => {
      cancelled = true;
    };
  }, [navigation, setSpotifySession]);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    try {
      const session = await loginWithSpotify();
      setSpotifySession(session);
      navigation.replace("Home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return <View style={styles.screen} />;
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <PulseWaveform />

        <Text style={styles.headline}>
          Haz que tu música nunca más te vuelva a sacar del momento que estás viviendo.
        </Text>
        <Text style={styles.subheadline}>
          Conecta tu banda y tu cuenta de Spotify: la cola se adapta a tu ritmo cardíaco en tiempo
          real, ya sea que estés estudiando o entrenando.
        </Text>
      </View>

      <View style={styles.footer}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <SpotifyLoginButton onPress={handleLogin} loading={loading} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xxl,
  },
  waveform: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 40,
    marginBottom: spacing.xxxl,
  },
  waveformBar: {
    width: 5,
    height: 40,
    borderRadius: 3,
    backgroundColor: colors.pulseCalm,
  },
  headline: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 28,
    lineHeight: 34,
    maxWidth: 320,
  },
  subheadline: {
    color: colors.inkMuted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.lg,
    maxWidth: 320,
  },
  footer: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  error: {
    color: colors.pulseHot,
    fontSize: 13,
    textAlign: "center",
  },
});
