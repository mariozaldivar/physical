import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radii, spacing } from "../theme/theme";
import {
  BLE_SUPPORTED,
  connectToDevice as connectToRealDevice,
  startScan as startRealScan,
} from "../services/band";
import {
  connectToDevice as connectToSimulatedDevice,
  startScan as startSimulatedScan,
  type BandSource,
  type DiscoveredDevice,
  type ScanHandle,
} from "../services/bleScanner";

type ConnectStatus = "scanning" | "connecting" | "connected" | "error";

interface BleConnectModalProps {
  visible: boolean;
  onClose: () => void;
  onConnected: (device: DiscoveredDevice, source: BandSource) => void;
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

/** Pequeño "pop" al confirmar la conexión — el único momento de éxito del modal, merece un acento. */
function ConnectedBadge() {
  const scale = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }).start();
  }, [scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Ionicons name="checkmark-circle" size={18} color={colors.pulseCalm} style={styles.rowIcon} />
    </Animated.View>
  );
}

export function BleConnectModal({ visible, onClose, onConnected }: BleConnectModalProps) {
  const [status, setStatus] = useState<ConnectStatus>("scanning");
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [selected, setSelected] = useState<DiscoveredDevice | null>(null);
  // En web nunca hay BLE real (react-native-ble-plx es nativo), así que ahí se
  // arranca directamente en simulado. En nativo se empieza con la banda real y
  // el simulado queda como salida manual — ver el botón al final del modal.
  const [source, setSource] = useState<BandSource>(BLE_SUPPORTED ? "band" : "simulated");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Contador de intentos: "Reintentar" tiene que relanzar el scan de verdad,
  // y el efecto de abajo sólo reacciona a sus dependencias. Sin esto el botón
  // dejaba la pantalla en "buscando" sin ningún scan corriendo detrás.
  const [scanAttempt, setScanAttempt] = useState(0);
  // Cierra la ventana entre "el usuario tocó un dispositivo" y "la promesa de
  // connectToDevice resuelve": sin esto, cancelar (Cancelar / tocar el fondo)
  // mientras está "connecting" no interrumpe la conexión simulada en curso —
  // sigue completando en segundo plano y dispara onConnected (arranca una
  // sesión) aunque el usuario ya haya cerrado el modal.
  const activeRef = useRef(false);
  // Handle del scan en curso, para poder pararlo al elegir un dispositivo.
  const scanRef = useRef<ScanHandle | null>(null);

  useEffect(() => {
    if (!visible) {
      activeRef.current = false;
      return;
    }
    activeRef.current = true;
    setStatus("scanning");
    setDevices([]);
    setSelected(null);
    setErrorMessage(null);

    const useRealBle = source === "band" && BLE_SUPPORTED;
    // Un scan BLE real reporta el MISMO dispositivo en cada anuncio que emite
    // (varias veces por segundo). Sin deduplicar por id, la lista crecería sin
    // parar con copias de la misma banda — el scanner simulado nunca lo hacía
    // notar porque emite cada device una sola vez.
    const onDeviceFound = (device: DiscoveredDevice) =>
      setDevices((prev) => {
        const index = prev.findIndex((candidate) => candidate.id === device.id);
        if (index === -1) return [...prev, device];
        const next = [...prev];
        next[index] = device; // refresca el RSSI, que sí cambia entre anuncios
        return next;
      });

    const scan = useRealBle
      ? startRealScan(onDeviceFound, (error) => {
          if (!activeRef.current) return;
          setErrorMessage(error.message);
          setStatus("error");
        })
      : startSimulatedScan(onDeviceFound);

    scanRef.current = scan;
    return () => {
      activeRef.current = false;
      scan.stop();
      scanRef.current = null;
    };
  }, [visible, source, scanAttempt]);

  async function handleSelect(device: DiscoveredDevice) {
    // Escanear y conectar a la vez compite por la misma radio: en Android el
    // handshake GATT se vuelve lento o falla directamente si el scan sigue
    // corriendo. Ya se eligió una banda, el scan no aporta nada más.
    scanRef.current?.stop();
    scanRef.current = null;

    setSelected(device);
    setStatus("connecting");
    setErrorMessage(null);
    const connect = source === "band" && BLE_SUPPORTED ? connectToRealDevice : connectToSimulatedDevice;
    try {
      await connect(device.id);
      if (!activeRef.current) return;
      setStatus("connected");
      setTimeout(() => {
        if (activeRef.current) onConnected(device, source);
      }, 550);
    } catch (error) {
      if (!activeRef.current) return;
      setErrorMessage(error instanceof Error ? error.message : null);
      setStatus("error");
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
              <Text style={styles.subtitle} accessibilityLiveRegion="polite">
                {status === "scanning" &&
                  (source === "simulated" ? "Modo simulado · sin hardware" : "Buscando dispositivos cercanos…")}
                {status === "connecting" && `Conectando con ${selected?.name}…`}
                {status === "connected" && `Conectado con ${selected?.name}`}
                {status === "error" && (errorMessage ?? "No se pudo conectar. Intenta de nuevo.")}
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
                  disabled={status !== "scanning"}
                  accessibilityRole="button"
                  accessibilityLabel={`${device.name}, señal ${bars} de 3`}
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
                  {isSelected && status === "connected" && <ConnectedBadge />}
                  {isSelected && status === "error" && (
                    <Ionicons name="alert-circle" size={18} color={colors.pulseHot} style={styles.rowIcon} />
                  )}
                </Pressable>
              );
            })}

            {devices.length === 0 && status === "scanning" && (
              <Text style={styles.emptyHint}>
                {source === "simulated"
                  ? "Preparando banda simulada…"
                  : "Asegúrate de que la banda esté encendida y cerca. Sólo aparecen bandas con sensor de pulso estándar."}
              </Text>
            )}
          </View>

          {status === "error" && (
            <Pressable
              style={styles.retryButton}
              accessibilityRole="button"
              accessibilityLabel="Reintentar búsqueda"
              onPress={() => {
                setStatus("scanning");
                setSelected(null);
                setErrorMessage(null);
                setScanAttempt((attempt) => attempt + 1);
              }}
            >
              <Text style={styles.retryButtonText}>Reintentar</Text>
            </Pressable>
          )}

          {/* Plan B documentado en Checklist_demo_proyecto.md (punto 0): si el
              Bluetooth falla en vivo, se puede demostrar el flujo completo sin
              hardware. Sólo se ofrece si hay BLE real disponible — en web ya se
              arranca en simulado y el botón no diría nada nuevo. */}
          {BLE_SUPPORTED && source === "band" && (
            <Pressable
              onPress={() => setSource("simulated")}
              accessibilityRole="button"
              accessibilityLabel="Usar banda simulada, sin hardware"
              style={styles.fallbackButton}
            >
              <Text style={styles.fallbackButtonText}>Usar banda simulada</Text>
            </Pressable>
          )}

          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cancelar" style={styles.cancelButton}>
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
  fallbackButton: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  fallbackButtonText: {
    color: colors.inkMuted,
    fontFamily: fonts.displayMedium,
    fontSize: 12.5,
    textDecorationLine: "underline",
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
