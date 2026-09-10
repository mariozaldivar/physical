#pragma once

#include <Arduino.h>

class BLECharacteristic;  // fwd decl — evita meter <BLEDevice.h> en este header

/**
 * Estado del sensor tal como se reporta al cliente BLE. Se mapea al campo
 * "Sensor Contact Status/Support" del flags byte del Heart Rate Measurement
 * (ver BleHeartRateService.cpp), así que no hace falta un characteristic
 * propietario para que la app distinga los tres casos.
 */
enum class SensorStatus : uint8_t {
  NotDetected,  // el MAX30102 no contesta en el bus I2C (mal soldado, cable suelto, sin alimentación)
  NoContact,    // sensor OK, pero no hay dedo/muñeca encima
  Measuring,    // sensor OK y con contacto: el BPM notificado es real
};

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
  // Con status != Measuring se notifica siempre bpm 0.
  void notifyHeartRate(uint8_t bpm, SensorStatus status);

  bool isConnected() const { return _connected; }

  // Llamado por el callback interno del servidor BLE (ver .cpp) — no llamar directo.
  void setConnected(bool connected) { _connected = connected; }

 private:
  BLECharacteristic* _heartRateMeasurementCharacteristic = nullptr;
  bool _connected = false;
};

extern BleHeartRateService bleHeartRateService;
