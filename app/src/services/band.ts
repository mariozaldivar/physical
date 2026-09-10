/**
 * Cliente de la banda, resuelto por plataforma.
 *
 * Este archivo es la variante **web**: `react-native-ble-plx` es un módulo
 * nativo y no existe en el navegador, así que aquí no hay BLE real. Metro
 * resuelve `band.native.ts` en iOS/Android (convención de plataforma, la
 * misma que ya protegía a `bleHeartRateService.native.ts` de romper el
 * bundle web), así que importar `services/band` es seguro en las dos.
 *
 * Los consumidores deben mirar `BLE_SUPPORTED` antes de llamar a nada de
 * aquí: en web toca usar el flujo simulado de `bleScanner.ts`.
 */

import type { DiscoveredDevice, HeartRateReading, HeartRateSubscription, ScanHandle } from "./bleScanner";

export const BLE_SUPPORTED = false;

const NO_BLE = "El Bluetooth real no está disponible en web — usa el modo simulado.";

export function startScan(
  _onDeviceFound: (device: DiscoveredDevice) => void,
  onError?: (error: Error) => void,
): ScanHandle {
  onError?.(new Error(NO_BLE));
  return { stop: () => {} };
}

export function connectToDevice(_deviceId: string): Promise<void> {
  return Promise.reject(new Error(NO_BLE));
}

export function disconnectFromDevice(_deviceId: string): Promise<void> {
  return Promise.resolve();
}

export function subscribeToHeartRate(
  _deviceId: string,
  _onReading: (reading: HeartRateReading) => void,
  onError?: (error: Error) => void,
): HeartRateSubscription {
  onError?.(new Error(NO_BLE));
  return { remove: () => {} };
}

export function subscribeToDisconnection(
  _deviceId: string,
  _onDisconnected: () => void,
): HeartRateSubscription {
  return { remove: () => {} };
}
