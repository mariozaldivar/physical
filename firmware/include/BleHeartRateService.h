#pragma once

#include <Arduino.h>

class BLECharacteristic;  // fwd decl — evita meter <BLEDevice.h> en este header

/**
 * Expone el Heart Rate Service BLE estándar (UUID 0x180D, característica de
 * medición 0x2A37) — ver Stack_tecnico_proyecto.md, sección 2. Cualquier
 * cliente BLE que sepa leer este perfil estándar (incluida la app Physical,
 * vía react-native-ble-plx en app/src/services/bleHeartRateService.native.ts)
 * puede conectarse sin protocolo propio.
 */
class BleHeartRateService {
 public:
  void begin(const char* deviceName);

  // BPM 0-255 — formato UINT8 del characteristic estándar (alcanza de sobra
  // para pulso humano, no hace falta el formato UINT16 opcional de la spec).
  void notifyHeartRate(uint8_t bpm);

  bool isConnected() const { return _connected; }

  // Llamado por el callback interno del servidor BLE (ver .cpp) — no llamar directo.
  void setConnected(bool connected) { _connected = connected; }

 private:
  BLECharacteristic* _heartRateMeasurementCharacteristic = nullptr;
  bool _connected = false;
};

extern BleHeartRateService bleHeartRateService;
