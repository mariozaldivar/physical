import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radii, spacing } from "../theme/theme";
import { connectToDevice, startScan, type DiscoveredDevice } from "../services/bleScanner";

type ConnectStatus = "scanning" | "connecting" | "connected" | "error";

interface BleConnectModalProps {
  visible: boolean;
  onClose: () => void;
  onConnected: (device: DiscoveredDevice) => void;
}

function signalBars(rssi: number) {
  // BLE ronda entre ~-40 dBm (excelente) y ~-100 dBm (apenas detectable).
  if (rssi >= -55) return 3;
  if (rssi >= -75) return 2;
  return 1;
}

function RadarPulse() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });

  return (
    <View style={styles.radarWrap}>
      <Animated.View style={[styles.radarRing, { transform: [{ scale }], opacity }]} />
      <View style={styles.radarCore}>
        <Ionicons name="bluetooth" size={22} color={colors.pulseCalm} />
      </View>
    </View>
  );
}

export function BleConnectModal({ visible, onClose, onConnected }: BleConnectModalProps) {
  const [status, setStatus] = useState<ConnectStatus>("scanning");
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [selected, setSelected] = useState<DiscoveredDevice | null>(null);
  // Cierra la ventana entre "el usuario tocó un dispositivo" y "la promesa de
  // connectToDevice resuelve": sin esto, cancelar (Cancelar / tocar el fondo)
  // mientras está "connecting" no interrumpe la conexión simulada en curso —
  // sigue completando en segundo plano y dispara onConnected (arranca una
  // sesión) aunque el usuario ya haya cerrado el modal.
  const activeRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      activeRef.current = false;
      return;
    }
    activeRef.current = true;
    setStatus("scanning");
    setDevices([]);
    setSelected(null);
    const scan = startScan((device) => setDevices((prev) => [...prev, device]));
    return () => {
      activeRef.current = false;
      scan.stop();
    };
  }, [visible]);

  async function handleSelect(device: DiscoveredDevice) {
    setSelected(device);
    setStatus("connecting");
    try {
      await connectToDevice(device.id);
      if (!activeRef.current) return;
      setStatus("connected");
      setTimeout(() => {
        if (activeRef.current) onConnected(device);
      }, 550);
    } catch {
      if (activeRef.current) setStatus("error");
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <RadarPulse />
            <View style={styles.headerText}>
              <Text style={styles.title}>Conectar banda</Text>
              <Text style={styles.subtitle}>
                {status === "scanning" && "Buscando dispositivos cercanos…"}
                {status === "connecting" && `Conectando con ${selected?.name}…`}
                {status === "connected" && `Conectado con ${selected?.name}`}
                {status === "error" && "No se pudo conectar. Intenta de nuevo."}
              </Text>
            </View>
          </View>

          <View style={styles.list}>
            {devices.map((device) => {
              const isSelected = selected?.id === device.id;
              const bars = signalBars(device.rssi);
              return (
                <Pressable
                  key={device.id}
                  onPress={() => status === "scanning" && handleSelect(device)}
                  style={[styles.row, isSelected && styles.rowSelected]}
                >
                  <Ionicons name="bluetooth" size={18} color={colors.pulseCalm} />
                  <Text style={styles.rowName}>{device.name}</Text>

                  <View style={styles.signalBars}>
                    {[1, 2, 3].map((bar) => (
                      <View
                        key={bar}
                        style={[
                          styles.signalBar,
                          { height: 4 + bar * 3 },
                          bar <= bars ? styles.signalBarActive : styles.signalBarInactive,
                        ]}
                      />
                    ))}
                  </View>

                  {isSelected && status === "connecting" && (
                    <Ionicons name="sync" size={16} color={colors.inkMuted} style={styles.rowIcon} />
                  )}
                  {isSelected && status === "connected" && (
                    <Ionicons name="checkmark-circle" size={18} color={colors.pulseCalm} style={styles.rowIcon} />
                  )}
                  {isSelected && status === "error" && (
                    <Ionicons name="alert-circle" size={18} color={colors.pulseHot} style={styles.rowIcon} />
                  )}
                </Pressable>
              );
            })}

            {devices.length === 0 && status === "scanning" && (
              <Text style={styles.emptyHint}>Asegúrate de que la banda esté encendida y cerca.</Text>
            )}
          </View>

          {status === "error" && (
            <Pressable
              style={styles.retryButton}
              onPress={() => {
                setStatus("scanning");
                setSelected(null);
              }}
            >
              <Text style={styles.retryButtonText}>Reintentar</Text>
            </Pressable>
          )}

          <Pressable onPress={onClose} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(4,6,12,0.6)",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.hairline,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  radarWrap: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  radarRing: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.pulseCalm,
  },
  radarCore: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.pulseCalmDim,
    alignItems: "center",
    justifyContent: "center",
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
    fontSize: 13,
    marginTop: 2,
  },
  list: {
    gap: spacing.sm,
    minHeight: 64,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: "transparent",
  },
  rowSelected: {
    borderColor: colors.pulseCalm,
  },
  rowName: {
    flex: 1,
    color: colors.ink,
    fontFamily: fonts.displayMedium,
    fontSize: 14,
  },
  rowIcon: {
    marginLeft: spacing.sm,
  },
  signalBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
  },
  signalBar: {
    width: 3,
    borderRadius: 1.5,
  },
  signalBarActive: {
    backgroundColor: colors.pulseCalm,
  },
  signalBarInactive: {
    backgroundColor: colors.hairline,
  },
  emptyHint: {
    color: colors.inkFaint,
    fontSize: 12.5,
    paddingVertical: spacing.md,
  },
  retryButton: {
    alignSelf: "flex-start",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.pulseHot,
  },
  retryButtonText: {
    color: colors.pulseHot,
    fontFamily: fonts.displayMedium,
    fontSize: 13,
  },
  cancelButton: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  cancelButtonText: {
    color: colors.inkMuted,
    fontSize: 13,
  },
});
