/**
 * Cliente de la banda en nativo (iOS/Android): el BLE real.
 *
 * Ver `band.ts` para la variante web y por qué existe este par de archivos.
 * La implementación vive en `bleHeartRateService.native.ts`; esto sólo la
 * expone bajo el nombre que consumen las pantallas, para que el punto de
 * decisión "¿hay BLE en esta plataforma?" sea un único import.
 */

export {
  connectToDevice,
  disconnectFromDevice,
  startScan,
  subscribeToDisconnection,
  subscribeToHeartRate,
} from "./bleHeartRateService.native";

export const BLE_SUPPORTED = true;
