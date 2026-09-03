(Este es un archivo de instrucciones, al terminar de implementar lo que se encuentra en él, archívalo).

Trabajaremos en la interfaz de conexión por Bluetooth con el protocolo propuesto con el ESP-32 (sin aún utilizar el ESP). Diseña el componente donde se mostrará el proceso de conexión (en caso de que haya conflictos con los métodos de conexión nativos de iOS házmelo saber antes de continuar). Este será un overlay modal en el que aparecerán los dispositivos compatibles detectados por bluetooth, y el usuario podrá sincronizarse tocando el listado del dispositivo.

---

**Estado (archivado 2026-09-02):**

- `app/src/components/BleConnectModal.tsx` — modal tipo bottom-sheet: radar pulsante, lista de dispositivos apareciendo progresivamente, barras de señal por rssi, estados scanning/connecting/connected/error con reintento. Conectado al botón "Iniciar sesión" de `HomeScreen`.
- Conflictos de iOS reportados antes de construir (ver el mensaje al usuario en la conversación): `react-native-ble-plx` no corre en Expo Go ni web (necesita Dev Client), requiere `NSBluetoothAlwaysUsageDescription` en Info.plist, y BLE genérico no pasa por el diálogo de emparejamiento de Ajustes (eso es correcto, no un choque) salvo que el characteristic requiera bonding.
- Decisión tomada: **no se instaló `react-native-ble-plx` todavía**. `app/src/services/bleScanner.ts` simula el scan con la misma forma de datos (id, name, rssi) que tendría uno real, para poder seguir probando en web. Cuando haya ESP-32 físico, ese archivo es el único que hay que reemplazar.
