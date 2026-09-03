/**
 * Cliente BLE REAL para la banda Physical — lee el Heart Rate Service BLE
 * estándar (UUID 0x180D, característica de medición 0x2A37) que expone el
 * firmware en ../../../firmware (ver ese README para wiring/flasheo). Al usar
 * el perfil estándar, esto también sirve para conectarse a cualquier otra
 * banda/reloj compatible con Heart Rate Service, no sólo la de Physical (ver
 * justificación en Stack_tecnico_proyecto.md §2).
 *
 * Sólo nativo (iOS/Android, requiere Expo Dev Client — react-native-ble-plx
 * no corre en Expo Go ni en web). Por eso vive en un archivo `.native.ts`:
 * Metro nunca lo resuelve para `platform=web`, así que importarlo no puede
 * romper el bundle web (mismo tipo de problema que ya rompió el bundle de
 * expo-sqlite en web una vez — ver metro.config.js e Informe_retrieval_datos.md).
 *
 * A propósito NO está conectado a BleConnectModal/sessionStore todavía — no
 * hay banda física con la que probar el handshake real en este momento (ver
 * INSTRUCCIONES.md, tarea 1: "crea los scripts... aunque aún no estén
 * integrados"). Expone el mismo shape de `DiscoveredDevice`/`ScanHandle` que
 * services/bleScanner.ts (el simulado, que sigue siendo lo que usa la app
 * hoy) para que integrarlo más adelante sea, en lo posible, un cambio de
 * import — ver ese archivo para el resto del contrato esperado.
 */

import { PermissionsAndroid, Platform } from "react-native";
import { BleManager, type Device, type Subscription } from "react-native-ble-plx";
import type { DiscoveredDevice, ScanHandle } from "./bleScanner";

// UUIDs completos (base de Bluetooth SIG) del Heart Rate Service estándar —
// ver GATT Specification Supplement. react-native-ble-plx acepta UUID como
// string plano; se usa la forma completa para no depender de que la
// librería expanda correctamente un UUID corto de 16 bits.
export const HEART_RATE_SERVICE_UUID = "0000180d-0000-1000-8000-00805f9b34fb";
export const HEART_RATE_MEASUREMENT_UUID = "00002a37-0000-1000-8000-00805f9b34fb";

export interface HeartRateReading {
  bpm: number;
  /** null si el sensor no reporta si soporta detección de contacto (bit "sensor contact support" de la spec en 0). */
  sensorContactDetected: boolean | null;
}

let manager: BleManager | null = null;

function getManager(): BleManager {
  if (Platform.OS === "web") {
    // No debería alcanzarse nunca en la práctica (Metro no bundlea este
    // archivo para web), pero deja el fallo explícito si algo lo importa mal.
    throw new Error("BLE real no está disponible en web — este módulo es sólo para iOS/Android.");
  }
  if (!manager) manager = new BleManager();
  return manager;
}

/**
 * Android 12+ (API 31+) requiere BLUETOOTH_SCAN/BLUETOOTH_CONNECT pedidos en
 * runtime, no sólo declarados en el manifest (el plugin de Expo en app.json
 * ya los declara — ver "react-native-ble-plx" en `plugins`). Android <12
 * requiere permiso de ubicación para poder escanear BLE (requisito de la
 * plataforma, no de esta librería). iOS no necesita este paso: el prompt del
 * sistema aparece solo al usar BLE, a partir de
 * NSBluetoothAlwaysUsageDescription (también puesto por el plugin de Expo).
 */
async function ensureBlePermissions(): Promise<void> {
  if (Platform.OS !== "android") return;

  const apiLevel = typeof Platform.Version === "number" ? Platform.Version : parseInt(Platform.Version, 10);

  if (apiLevel >= 31) {
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    const allGranted = Object.values(granted).every((status) => status === PermissionsAndroid.RESULTS.GRANTED);
    if (!allGranted) {
      throw new Error("Physical necesita permiso de Bluetooth para buscar tu banda.");
    }
    return;
  }

  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new Error(
      "Physical necesita permiso de ubicación para buscar dispositivos Bluetooth (requisito de Android para BLE en versiones anteriores a Android 12).",
    );
  }
}

/**
 * Escanea dispositivos que anuncien el Heart Rate Service estándar. Mismo
 * shape que bleScanner.ts (`DiscoveredDevice`/`ScanHandle`), con un
 * `onError` opcional adicional — el scanner simulado nunca falla, pero uno
 * real sí puede (permisos denegados, Bluetooth apagado, etc.) y silenciarlo
 * sería peor que extender la firma.
 */
export function startScan(
  onDeviceFound: (device: DiscoveredDevice) => void,
  onError?: (error: Error) => void,
): ScanHandle {
  const bleManager = getManager();
  let stopped = false;

  ensureBlePermissions()
    .then(() => {
      if (stopped) return;
      bleManager.startDeviceScan([HEART_RATE_SERVICE_UUID], null, (error, device) => {
        if (error) {
          onError?.(error);
          return;
        }
        if (!device) return;
        onDeviceFound({
          id: device.id,
          name: device.name ?? device.localName ?? "Banda sin nombre",
          rssi: device.rssi ?? -100,
        });
      });
    })
    .catch((error: unknown) => onError?.(error instanceof Error ? error : new Error(String(error))));

  return {
    stop: () => {
      stopped = true;
      bleManager.stopDeviceScan().catch(() => {});
    },
  };
}

/** Conecta y descubre servicios/características — deja el device listo para subscribeToHeartRate. */
export async function connectToDevice(deviceId: string): Promise<void> {
  const bleManager = getManager();
  const device = await bleManager.connectToDevice(deviceId);
  await device.discoverAllServicesAndCharacteristics();
}

/** Ver Planeacion_proyecto.md: "al terminar la sesión, desactivar el sensor de la pulsera". */
export function disconnectFromDevice(deviceId: string): Promise<Device> {
  return getManager().cancelDeviceConnection(deviceId);
}

/**
 * Suscribe a notificaciones del characteristic de medición de pulso (0x2A37).
 * Llamar `.remove()` sobre el `Subscription` devuelto para dejar de escuchar.
 */
export function subscribeToHeartRate(
  deviceId: string,
  onReading: (reading: HeartRateReading) => void,
  onError?: (error: Error) => void,
): Subscription {
  return getManager().monitorCharacteristicForDevice(
    deviceId,
    HEART_RATE_SERVICE_UUID,
    HEART_RATE_MEASUREMENT_UUID,
    (error, characteristic) => {
      if (error) {
        onError?.(error);
        return;
      }
      const reading = characteristic?.value ? parseHeartRateMeasurement(characteristic.value) : null;
      if (reading) onReading(reading);
    },
  );
}

/**
 * Parsea el characteristic "Heart Rate Measurement" (spec del Bluetooth SIG,
 * GATT Specification Supplement): byte 0 = flags (bit 0 = formato del valor,
 * UINT8 si es 0 / UINT16 LE si es 1; bit 1 = contacto detectado, sólo válido
 * si bit 2 = 1; bit 2 = el sensor soporta reportar contacto). El resto de
 * bytes que puede traer el payload (energía gastada, intervalos RR) no se
 * usa en Physical, así que ni se parsea — sólo hace falta el BPM.
 */
function parseHeartRateMeasurement(base64Value: string): HeartRateReading | null {
  const bytes = decodeBase64ToBytes(base64Value);
  if (bytes.length === 0) return null;

  const flags = bytes[0];
  const isUint16 = (flags & 0x01) === 1;
  const sensorContactSupported = (flags & 0x04) !== 0;
  const sensorContactDetected = sensorContactSupported ? (flags & 0x02) !== 0 : null;

  if (isUint16) {
    if (bytes.length < 3) return null;
    return { bpm: bytes[1] | (bytes[2] << 8), sensorContactDetected };
  }
  if (bytes.length < 2) return null;
  return { bpm: bytes[1], sensorContactDetected };
}

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * Decodificador de base64 manual: `atob`/`Buffer` no están garantizados como
 * globales en todos los runtimes de React Native/Hermes. react-native-ble-plx
 * entrega `characteristic.value` en base64 — hay que decodificarlo a bytes
 * para poder leer los flags/BPM de la spec.
 */
function decodeBase64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/=+$/, "");
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    const value = BASE64_CHARS.indexOf(char);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(bytes);
}
