import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radii, spacing, zoneColor } from "../theme/theme";
import { MAX_FONT_SCALE, MIN_BLOCK_HEIGHT, useScreenSize } from "../theme/layout";
import type { BpmReading } from "../types/music";

const CONNECTION_COPY: Record<BpmReading["connection"], string> = {
  connected: "Banda conectada",
  scanning: "Buscando banda…",
  disconnected: "Banda desconectada",
};

/**
 * Con la banda conectada, el texto tiene que distinguir tres situaciones que
 * para el usuario son problemas distintos: la banda no trae sensor que
 * responda (mal soldado/desconectado — el firmware lo reporta como "sensor
 * contact not supported"), la trae pero no está en contacto con la piel, o
 * está midiendo de verdad. Sin esto, las tres se ven igual: "Banda conectada"
 * con 0 BPM.
 */
function statusCopy(connection: BpmReading["connection"], sensorContact: boolean | null | undefined): string {
  if (connection !== "connected") return CONNECTION_COPY[connection];
  if (sensorContact === null || sensorContact === undefined) return "Banda conectada · sin sensor";
  if (!sensorContact) return "Banda conectada · sin contacto";
  return "Banda conectada";
}

const CONNECTION_DOT_COLOR: Record<BpmReading["connection"], string> = {
  connected: colors.pulseCalm,
  scanning: colors.pulseHot,
  disconnected: colors.inkFaint,
};

interface BpmMonitorBarProps {
  reading: BpmReading;
}

/**
 * Barra horizontal (≈1/5 de pantalla) con el BPM detectado por la banda.
 * El corazón late en tiempo real: cada ciclo de la animación dura 60000/bpm ms,
 * el mismo intervalo que separa dos pulsaciones reales.
 */
export function BpmMonitorBar({ reading }: BpmMonitorBarProps) {
  const { bpm, zone, connection, sensorContact } = reading;
  const { compact } = useScreenSize();
  const beat = useRef(new Animated.Value(0)).current;
  // "Conectada" no alcanza para latir: una banda conectada sin sensor manda 0
  // BPM, y animar eso daría un latido inventado a ritmo del mínimo de 260ms.
  const isLive = connection === "connected" && bpm > 0;

  useEffect(() => {
    beat.stopAnimation();
    beat.setValue(0);
    if (!isLive) return;

    const beatIntervalMs = Math.max(60000 / Math.max(bpm, 1), 260);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(beat, {
          toValue: 1,
          duration: beatIntervalMs * 0.28,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(beat, {
          toValue: 0,
          duration: beatIntervalMs * 0.72,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [beat, bpm, isLive]);

  const scale = beat.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] });
  const accent = isLive ? zoneColor(zone) : colors.inkFaint;

  return (
    <View style={[styles.bar, compact && styles.barCompact]}>
      <View style={styles.leftBlock}>
        <Text
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          style={[
            styles.bpmValue,
            compact && styles.bpmValueCompact,
            { color: isLive ? colors.ink : colors.inkFaint },
          ]}
        >
          {isLive ? Math.round(bpm) : "--"}
        </Text>
        <View style={styles.subtitleRow}>
          <View style={[styles.dot, { backgroundColor: CONNECTION_DOT_COLOR[connection] }]} />
          <Text style={styles.subtitle} numberOfLines={2}>
            {statusCopy(connection, sensorContact)}
          </Text>
        </View>
      </View>

      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons
          name={isLive ? "heart" : "heart-outline"}
          size={compact ? 28 : 34}
          color={accent}
        />
      </Animated.View>

      <View style={[styles.zoneBar, { backgroundColor: accent }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flex: 1,
    // Piso de la barra cuando el alto de pantalla ya no alcanza para repartir
    // proporcionalmente — por debajo de esto el numeral deja de respirar.
    minHeight: MIN_BLOCK_HEIGHT.monitor,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    overflow: "hidden",
  },
  barCompact: {
    paddingHorizontal: spacing.lg,
  },
  leftBlock: {
    flexShrink: 1,
    justifyContent: "center",
  },
  bpmValue: {
    fontFamily: fonts.display,
    fontSize: 44,
    lineHeight: 48,
  },
  bpmValueCompact: {
    fontSize: 36,
    lineHeight: 40,
  },
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  subtitle: {
    color: colors.inkMuted,
    fontSize: 13,
    flexShrink: 1,
  },
  zoneBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
  },
});
