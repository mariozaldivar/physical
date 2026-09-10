#include "HeartRateSensor.h"

#include "heartRate.h"

bool HeartRateSensor::detect() {
  // MAX30105::begin() ya llama Wire.begin() internamente y comprueba el PART
  // ID — no hace falta repetirlo (mismo patrón que el ejemplo oficial de
  // SparkFun). Devuelve false si el chip no contesta en el bus I2C, que es
  // exactamente el caso de "mal soldado / cable suelto / sin alimentación".
  if (!_sensor.begin(Wire, I2C_SPEED_FAST)) {
    _present = false;
    return false;
  }

  _sensor.setup();
  _sensor.setPulseAmplitudeRed(0x0A);
  _sensor.setPulseAmplitudeGreen(0);

  _present = true;
  _lastHealthCheckAt = millis();
  resetMeasurements();
  return true;
}

void HeartRateSensor::update() {
  if (!_present) return;

  unsigned long now = millis();
  if (now - _lastHealthCheckAt >= kHealthCheckIntervalMs) {
    _lastHealthCheckAt = now;
    // readRegister8() devuelve 0 cuando el esclavo no hace ACK, así que un
    // PART ID que ya no es 0x15 significa que el sensor se cayó del bus.
    if (_sensor.readPartID() != kExpectedPartId) {
      _present = false;
      resetMeasurements();
      return;
    }
  }

  _lastIrValue = _sensor.getIR();

  if (checkForBeat(_lastIrValue)) {
    long delta = millis() - _lastBeat;
    _lastBeat = millis();

    float beatsPerMinute = 60.0f / (delta / 1000.0f);

    // Descarta lecturas fuera de rango humano plausible (ruido/artefactos de
    // movimiento) antes de meterlas al promedio — mismo umbral que el
    // ejemplo de referencia de SparkFun.
    if (beatsPerMinute > 20 && beatsPerMinute < 255) {
      _rates[_rateSpot++] = (byte)beatsPerMinute;
      _rateSpot %= kRateSize;

      int total = 0;
      for (byte i = 0; i < kRateSize; i++) total += _rates[i];
      _beatAvg = total / kRateSize;
    }
  }

  // Sin esto, al quitar el dedo el characteristic BLE se queda notificando el
  // último promedio válido para siempre, como si el pulso siguiera ahí — la
  // app no tiene forma de distinguir "72 BPM reales" de "72 BPM viejos".
  if (!fingerDetected()) {
    resetMeasurements();
  }
}

void HeartRateSensor::resetMeasurements() {
  for (byte i = 0; i < kRateSize; i++) _rates[i] = 0;
  _rateSpot = 0;
  _beatAvg = 0;
  _lastIrValue = 0;
}
