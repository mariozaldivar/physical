#include "HeartRateSensor.h"

namespace {

// Promedia una ráfaga corta de muestras para estimar el nivel DC del pin sin
// que un pico aislado de ruido decida el resultado.
int readDcLevel(int pin) {
  long sum = 0;
  const int kSamples = 50;
  for (int i = 0; i < kSamples; i++) {
    sum += analogRead(pin);
    delay(2);
  }
  return (int)(sum / kSamples);
}

}  // namespace

bool HeartRateSensor::detect() {
  // 12 bits (0-4095) y atenuación de 11 dB para cubrir todo el rango de 3.3V:
  // la salida del Amped se polariza en VCC/2 y oscila alrededor, así que hace
  // falta el fondo de escala completo, no el rango reducido por defecto.
  analogReadResolution(12);
  analogSetPinAttenuation(kSignalPin, ADC_11db);

  int dc = readDcLevel(kSignalPin);
  if (dc < kDcMin || dc > kDcMax) {
    _present = false;
    return false;
  }

  _present = true;
  resetMeasurements();

  // La envolvente arranca colapsada en el DC actual y se abre con la señal
  // real; empezarla en 0/4095 daría un umbral absurdo durante los primeros
  // segundos y se perderían los primeros latidos.
  _peak = dc;
  _trough = dc;
  _amplitude = 0;
  _above = false;

  unsigned long now = millis();
  _lastSampleAt = micros();
  _lastHealthCheckAt = now;
  _lastEnvelopeDecayAt = now;
  return true;
}

void HeartRateSensor::update() {
  if (!_present) return;

  unsigned long nowUs = micros();
  if (nowUs - _lastSampleAt < kSampleIntervalUs) return;
  _lastSampleAt = nowUs;

  int signal = analogRead(kSignalPin);
  unsigned long now = millis();

  if (signal > _peak) _peak = signal;
  if (signal < _trough) _trough = signal;
  _amplitude = _peak - _trough;

  if (now - _lastHealthCheckAt >= kHealthCheckIntervalMs) {
    _lastHealthCheckAt = now;
    // El centro de la envolvente es el DC actual sin tener que volver a
    // muestrear. Si se sale de la banda plausible, el sensor dejó de estar
    // bien conectado/alimentado.
    int dc = (_peak + _trough) / 2;
    if (dc < kDcMin || dc > kDcMax) {
      _present = false;
      resetMeasurements();
      return;
    }
  }

  int threshold = _trough + (_amplitude * kThresholdPercent) / 100;

  if (signal > threshold) {
    // Sólo cuenta el flanco de subida: sin _above, cada muestra por encima
    // del umbral dentro del mismo latido volvería a disparar.
    if (!_above && _amplitude >= kContactAmplitude && now - _lastBeat >= kRefractoryMs) {
      _above = true;

      unsigned long delta = now - _lastBeat;
      _lastBeat = now;

      float beatsPerMinute = 60000.0f / (float)delta;

      // Descarta lecturas fuera de rango humano plausible (ruido/artefactos de
      // movimiento) antes de meterlas al promedio. El primer latido tras un
      // reset cae aquí solo, porque _lastBeat = 0 da un delta enorme.
      if (beatsPerMinute > 30 && beatsPerMinute < 220) {
        _rates[_rateSpot++] = (byte)beatsPerMinute;
        _rateSpot %= kRateSize;

        // Promedia sólo las posiciones ya escritas: si no, los ceros iniciales
        // hunden el promedio durante los primeros latidos.
        int total = 0;
        int counted = 0;
        for (byte i = 0; i < kRateSize; i++) {
          if (_rates[i] > 0) {
            total += _rates[i];
            counted++;
          }
        }
        _beatAvg = counted > 0 ? total / counted : 0;
      }
    }
  } else {
    _above = false;
  }

  if (now - _lastEnvelopeDecayAt >= kEnvelopeDecayMs) {
    _lastEnvelopeDecayAt = now;
    // Encoge la envolvente un 25% hacia su centro. Sin esto, un pico de ruido
    // aislado dejaría el umbral alto para siempre y el sensor se quedaría
    // sordo; con esto la envolvente vuelve a ajustarse a la señal real.
    int mid = (_peak + _trough) / 2;
    _peak -= (_peak - mid) / 4;
    _trough += (mid - _trough) / 4;
  }

  // Sin esto, al quitar el dedo el characteristic BLE se queda notificando el
  // último promedio válido para siempre, como si el pulso siguiera ahí — la
  // app no tiene forma de distinguir "72 BPM reales" de "72 BPM viejos".
  if (_amplitude < kContactAmplitude || now - _lastBeat > kBeatTimeoutMs) {
    resetMeasurements();
  }
}

void HeartRateSensor::printDiagnostics() const {
  Serial.println("Diagnostico analogico:");
  int dc = _present ? (_peak + _trough) / 2 : readDcLevel(kSignalPin);
  Serial.printf("  Senal (GPIO%d): DC=%d  %s\n", kSignalPin, dc,
                (dc >= kDcMin && dc <= kDcMax)
                    ? "[OK - polarizado cerca de VCC/2]"
                    : "[SOSPECHOSO - pin al aire, sin 3.3V, o GND flotando]");
  Serial.printf("  Amplitud pico-a-pico: %d (umbral de contacto: %d)\n", _amplitude,
                kContactAmplitude);
  if (!_present) {
    Serial.println("  -> Revisa VCC(rojo)=3.3V, GND(negro)=GND, Signal(morado)=GPIO34.");
  }
}

void HeartRateSensor::resetMeasurements() {
  for (byte i = 0; i < kRateSize; i++) _rates[i] = 0;
  _rateSpot = 0;
  _beatAvg = 0;
}
