/**
 * Scanner BLE simulado. Expone la misma forma de datos que tendría un scan
 * real de react-native-ble-plx (id, name, rssi) para que el día que llegue
 * el ESP-32 físico, este archivo sea el único que hay que reemplazar —
 * BleConnectModal y todo lo demás no deberían cambiar.
 *
 * No se instaló react-native-ble-plx todavía a propósito: requiere un Expo
 * Dev Client (no corre en Expo Go ni en web), y este proyecto se ha estado
 * probando en navegador. Ver la nota en components/INSTRUCTIONS.md archivado.
 */

export interface DiscoveredDevice {
  id: string;
  name: string;
  /** dBm, más cercano a 0 = señal más fuerte. Rango típico BLE: -40 a -100. */
  rssi: number;
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
