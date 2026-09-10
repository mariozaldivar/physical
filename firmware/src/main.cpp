#include <Arduino.h>

#include "BleHeartRateService.h"
#include "HeartRateSensor.h"
#include "I2cDiagnostics.h"

// Nombre con el que se anuncia la banda por BLE.
constexpr char kDeviceName[] = "Physical Band";

// Pines I2C por defecto del ESP-32 DevKitC (ver README.md, sección Wiring).
constexpr int kSdaPin = 21;
constexpr int kSclPin = 22;

// Cada cuánto se envía una notificación BLE con el BPM actual, y se imprime
// una línea de estado por Serial. El sensor se lee en cada loop() sin
// bloquear; notificar más rápido que esto no aporta nada — el characteristic
// estándar sólo lleva un entero de BPM.
constexpr unsigned long kNotifyIntervalMs = 1000;

// Cada cuánto se reintenta detectar el sensor (y se imprime el diagnóstico
// del bus) mientras no esté presente. Permite arreglar la soldadura con la
// banda encendida y ver cuándo empieza a responder, sin reflashear.
constexpr unsigned long kSensorRetryIntervalMs = 3000;

HeartRateSensor heartRateSensor;
unsigned long lastNotifyAt = 0;
unsigned long lastSensorRetryAt = 0;

SensorStatus currentStatus() {
  if (!heartRateSensor.isPresent()) return SensorStatus::NotDetected;
  return heartRateSensor.fingerDetected() ? SensorStatus::Measuring : SensorStatus::NoContact;
}

const char* statusLabel(SensorStatus status) {
  switch (status) {
    case SensorStatus::NotDetected: return "SENSOR NO DETECTADO";
    case SensorStatus::NoContact:   return "sensor OK - sin contacto";
    case SensorStatus::Measuring:   return "sensor OK - midiendo";
  }
  return "?";
}

void setup() {
  Serial.begin(115200);
  delay(1500);  // da tiempo a que el monitor serial se enganche antes del primer print
  Serial.println();
  Serial.println("=== Physical Band ===");

  // El BLE arranca SIEMPRE, aunque el sensor falle: así la banda es
  // localizable y reporta su propio estado (incluido "no hay sensor") en vez
  // de quedarse muerta esperando un sensor que quizá está mal soldado.
  bleHeartRateService.begin(kDeviceName);
  Serial.printf("BLE activo - anunciandose como \"%s\" (Heart Rate Service 0x180D).\n", kDeviceName);

  if (heartRateSensor.detect()) {
    Serial.println("MAX30102 detectado.");
  } else {
    Serial.println("MAX30102 NO detectado - se reintenta solo cada 3s.");
  }
}

void loop() {
  heartRateSensor.update();

  unsigned long now = millis();

  if (!heartRateSensor.isPresent() && now - lastSensorRetryAt >= kSensorRetryIntervalMs) {
    lastSensorRetryAt = now;
    printI2cDiagnostics(kSdaPin, kSclPin);
    if (heartRateSensor.detect()) {
      Serial.println("MAX30102 detectado - midiendo.");
    }
  }

  if (now - lastNotifyAt >= kNotifyIntervalMs) {
    lastNotifyAt = now;

    SensorStatus status = currentStatus();
    bleHeartRateService.notifyHeartRate((uint8_t)heartRateSensor.bpm(), status);

    Serial.printf("[%s] BPM=%d BLE=%s\n",
                  statusLabel(status),
                  heartRateSensor.bpm(),
                  bleHeartRateService.isConnected() ? "conectado" : "anunciando");
  }
}
