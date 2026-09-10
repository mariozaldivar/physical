#pragma once

#include <Arduino.h>

/**
 * Envuelve el Pulse Sensor Amped (salida analógica) y la detección de pulso
 * por umbral adaptativo: se muestrea la señal a 500 Hz, se sigue su envolvente
 * (pico/valle con decaimiento), y cada cruce de subida por encima del umbral
 * — con un periodo refractario que descarta rebotes — cuenta como latido. El
 * intervalo entre latidos consecutivos da el BPM instantáneo, promediado
 * sobre las últimas kRateSize lecturas para suavizar el ruido latido a latido.
 *
 * La interfaz pública es idéntica a la de la variante MAX30102 (../firmware),
 * a propósito: main.cpp y toda la capa BLE se comparten sin cambios.
 *
 * DIFERENCIA IMPORTANTE CONTRA LA VARIANTE MAX30102: un sensor analógico no
 * hace ACK ni tiene registro PART ID, así que NO se puede saber con certeza
 * si está conectado. `detect()` sólo comprueba que el pin esté polarizado
 * cerca de VCC/2, que es como se comporta un Amped alimentado — un pin al
 * aire normalmente no se queda ahí, pero puede hacerlo por casualidad. Es una
 * heurística, no la certeza que daba el ACK del bus I2C.
 */
class HeartRateSensor {
 public:
  // Configura el ADC y comprueba que la señal esté polarizada de forma
  // plausible. No bloquea más de ~100 ms y puede reintentarse en caliente.
  bool detect();

  // Debe llamarse en cada loop() — no bloquea. No-op si el sensor no está.
  // Internamente sólo muestrea cuando toca (500 Hz), así que llamarla más
  // seguido no distorsiona la medición.
  void update();

  bool isPresent() const { return _present; }
  int bpm() const { return _beatAvg; }
  bool fingerDetected() const { return _present && _amplitude >= kContactAmplitude; }

  // Imprime nivel DC y amplitud por Serial. Es el equivalente analógico del
  // diagnóstico I2C de la otra variante: sirve para verificar la soldadura y
  // para calibrar kContactAmplitude con el dedo puesto y sin él.
  void printDiagnostics() const;

 private:
  void resetMeasurements();

  // GPIO34: canal de ADC1. ADC2 queda descartado porque el driver de WiFi se
  // lo apropia y con BLE encendido el comportamiento no está garantizado;
  // ADC1 (GPIO32-39) siempre funciona. Ver README.md, sección Wiring.
  static const int kSignalPin = 34;

  // 500 Hz: la referencia de PulseSensor para que la detección de picos tenga
  // resolución suficiente en el intervalo entre latidos.
  static const unsigned long kSampleIntervalUs = 2000;

  // 300 ms entre latidos = tope de 200 BPM. Evita contar dos veces el mismo
  // latido cuando la onda dicrota (el "rebote" de la señal PPG) cruza el umbral.
  static const unsigned long kRefractoryMs = 300;

  // El umbral se pone al 55% de la envolvente: por encima del ruido del valle,
  // por debajo del pico incluso cuando la amplitud cae.
  static const int kThresholdPercent = 55;

  // Amplitud pico-a-pico mínima (en cuentas de ADC de 12 bits) para dar el
  // contacto por bueno. Sin dedo la señal es casi plana; con dedo son cientos
  // de cuentas. Calibrar con printDiagnostics() si hace falta.
  static const int kContactAmplitude = 150;

  // Banda de DC plausible para un Amped alimentado a 3.3V: su salida se
  // polariza cerca de VCC/2 (~2048 en 12 bits). La ventana es ancha a
  // propósito — sólo descarta el pin pegado a un riel.
  static const int kDcMin = 700;
  static const int kDcMax = 3500;

  // Cada cuánto se revalida la polarización mientras mide. Sin esto, un cable
  // que se suelta a media sesión dejaría el último BPM congelado.
  static const unsigned long kHealthCheckIntervalMs = 2000;

  // Cada cuánto encoge la envolvente hacia su centro, para que se adapte
  // cuando cambia la amplitud (dedo que se quita, presión que cambia).
  static const unsigned long kEnvelopeDecayMs = 500;

  // Sin latidos válidos durante este tiempo se descarta el BPM acumulado.
  static const unsigned long kBeatTimeoutMs = 2500;

  static const byte kRateSize = 4;

  bool _present = false;
  int _peak = 0;
  int _trough = 4095;
  int _amplitude = 0;
  bool _above = false;
  byte _rates[kRateSize] = {0};
  byte _rateSpot = 0;
  int _beatAvg = 0;
  unsigned long _lastBeat = 0;
  unsigned long _lastSampleAt = 0;
  unsigned long _lastHealthCheckAt = 0;
  unsigned long _lastEnvelopeDecayAt = 0;
};
