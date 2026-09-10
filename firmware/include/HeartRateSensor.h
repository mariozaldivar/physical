#pragma once

#include <Arduino.h>
#include <Wire.h>
#include "MAX30105.h"

/**
 * Envuelve el sensor MAX30102 (vía SparkFun MAX3010x library, compatible con
 * toda la familia MAX3010x incluido el MAX30102) y el algoritmo de detección
 * de pulso por picos de IR: mismo criterio que el ejemplo oficial
 * "Example5_HeartRate" de SparkFun — intervalo entre picos consecutivos ->
 * BPM instantáneo, promediado sobre las últimas kRateSize lecturas para
 * suavizar el ruido latido a latido.
 *
 * La presencia del sensor NO se asume: `detect()` puede fallar y volver a
 * intentarse en caliente, y `update()` revalida periódicamente que el chip
 * siga contestando en el bus. Es lo que permite usar la banda como
 * diagnóstico de soldadura — si el MAX30102 está mal soldado, el firmware lo
 * reporta en vez de quedarse colgado.
 */
class HeartRateSensor {
 public:
  // Intenta (re)detectar e inicializar el sensor. No bloquea: devuelve false
  // si no contestó, y puede volver a llamarse las veces que haga falta.
  bool detect();

  // Debe llamarse en cada loop() — no bloquea. No-op si el sensor no está.
  void update();

  bool isPresent() const { return _present; }
  int bpm() const { return _beatAvg; }
  bool fingerDetected() const { return _present && _lastIrValue >= kFingerThreshold; }

 private:
  void resetMeasurements();

  static const byte kRateSize = 4;
  static const long kFingerThreshold = 50000;

  // Cada cuánto se revalida que el sensor siga en el bus mientras mide. Sin
  // esto, un cable/soldadura que se suelta a media sesión dejaría el último
  // BPM congelado como si el pulso siguiera llegando.
  static const unsigned long kHealthCheckIntervalMs = 2000;

  // PART ID que devuelve el registro 0xFF en toda la familia MAX3010x
  // (constante MAX_30105_EXPECTEDPARTID de la librería de SparkFun, que es
  // static y no está expuesta en su header — es el mismo valor que su
  // begin() comprueba internamente).
  static const uint8_t kExpectedPartId = 0x15;

  MAX30105 _sensor;
  bool _present = false;
  byte _rates[kRateSize] = {0};
  byte _rateSpot = 0;
  long _lastBeat = 0;
  long _lastIrValue = 0;
  int _beatAvg = 0;
  unsigned long _lastHealthCheckAt = 0;
};
