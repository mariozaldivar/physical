/**
 * Scanner BLE **simulado**, y hogar de los tipos que comparten el cliente
 * simulado y el real (`bleHeartRateService.native.ts`).
 *
 * Ya no es lo que usa la app por defecto: en nativo el flujo real pasa por
 * `services/band` (ver ese archivo), que resuelve al cliente BLE de verdad.
 * Esto sigue vivo por dos razones concretas:
 *
 *  - **Web no tiene BLE.** `react-native-ble-plx` no corre en navegador, y la
 *    app se sigue probando ahí (`expo start --web`).
 *  - **Plan B de la feria.** Si el Bluetooth falla en vivo frente al jurado
 *    —el punto de falla más clásico de una demo— se puede caer a este flujo
 *    sin hardware (ver `Checklist_demo_proyecto.md`, punto 0).
 */

export interface DiscoveredDevice {
  id: string;
  name: string;
  /** dBm, más cercano a 0 = señal más fuerte. Rango típico BLE: -40 a -100. */
  rssi: number;
}

/**
 * De qué viene el BPM de la sesión en curso: la banda real por BLE, o el
 * flujo simulado. No es lo mismo que "hay o no hay sensor" — una banda real
 * conectada con el sensor mal soldado sigue siendo `"band"`.
 */
export type BandSource = "band" | "simulated";

/** Una lectura del characteristic 0x2A37 (o su equivalente simulado). */
export interface HeartRateReading {
  bpm: number;
  /**
   * Estado de contacto del sensor, leído de los bits "sensor contact" del
   * flags byte de la spec. `null` = la banda no reporta contacto en absoluto,
   * que es justo lo que manda el firmware de Physical cuando el MAX30102 no
   * responde en el bus I2C (ver `firmware/src/BleHeartRateService.cpp`).
   */
  sensorContactDetected: boolean | null;
}

/** Lo que devuelve `subscribeToHeartRate` — mismo shape que `Subscription` de react-native-ble-plx. */
export interface HeartRateSubscription {
  remove: () => void;
}

const MOCK_DEVICES: DiscoveredDevice[] = [
  { id: "physical-band-3F2A", name: "Physical Band 3F2A", rssi: -52 },
  { id: "physical-band-9C11", name: "Physical Band 9C11", rssi: -71 },
];

export interface ScanHandle {
  stop: () => void;
}

/**
 * Simula un scan BLE: los dispositivos van "apareciendo" progresivamente,
 * igual que ocurriría con anuncios BLE reales llegando en momentos distintos.
 */
export function startScan(onDeviceFound: (device: DiscoveredDevice) => void): ScanHandle {
  const timers = MOCK_DEVICES.map((device, index) =>
    setTimeout(() => onDeviceFound(device), 700 + index * 900),
  );
  return {
    stop: () => timers.forEach(clearTimeout),
  };
}

/** Simula el handshake de conexión GATT tras tocar un dispositivo en la lista. */
export function connectToDevice(deviceId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (MOCK_DEVICES.some((device) => device.id === deviceId)) {
        resolve();
      } else {
        reject(new Error("Dispositivo no encontrado."));
      }
    }, 1100);
  });
}
