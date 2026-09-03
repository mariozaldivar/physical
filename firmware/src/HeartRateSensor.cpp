#include "HeartRateSensor.h"

#include "heartRate.h"

bool HeartRateSensor::begin() {
  // MAX30105::begin() ya llama Wire.begin() internamente — no hace falta
  // repetirlo (mismo patrón que el ejemplo oficial de SparkFun).
  if (!_sensor.begin(Wire, I2C_SPEED_FAST)) {
    return false;
  }

  _sensor.setup();
  _sensor.setPulseAmplitudeRed(0x0A);
  _sensor.setPulseAmplitudeGreen(0);
  return true;
}

void HeartRateSensor::update() {
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
    _beatAvg = 0;
  }
}
