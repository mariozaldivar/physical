#pragma once

#include <Arduino.h>
#include <Wire.h>
#include "MAX30105.h"

/**
 * Envuelve el sensor MAX30102 (vía SparkFun MAX3010x library, compatible con
 * toda la familia MAX3010x incluido el MAX30102) y el algoritmo de detección
 * de pulso por picos de IR: mismo criterio que el ejemplo oficial
 * "Example5_HeartRate" de SparkFun — intervalo entre picos consecutivos ->
 * BPM instantáneo, promediado sobre las últimas RATE_SIZE lecturas para
 * suavizar el ruido latido a latido.
 */
class HeartRateSensor {
 public:
  // Devuelve false si no se detectó el sensor (revisar wiring I2C/alimentación).
  bool begin();

  // Debe llamarse en cada loop() — no bloquea.
  void update();

  int bpm() const { return _beatAvg; }
  bool fingerDetected() const { return _lastIrValue >= kFingerThreshold; }

 private:
  static const byte kRateSize = 4;
  static const long kFingerThreshold = 50000;

  MAX30105 _sensor;
  byte _rates[kRateSize] = {0};
  byte _rateSpot = 0;
  long _lastBeat = 0;
  long _lastIrValue = 0;
  int _beatAvg = 0;
};
