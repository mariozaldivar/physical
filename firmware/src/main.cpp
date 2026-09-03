#include <Arduino.h>

#include "BleHeartRateService.h"
#include "HeartRateSensor.h"

// Nombre con el que se anuncia la banda por BLE.
constexpr char kDeviceName[] = "Physical Band";

// Cada cuánto se envía una notificación BLE con el BPM actual. El sensor se
// lee en cada loop() sin bloquear, pero notificar más rápido que esto no
// aporta nada — el characteristic estándar sólo lleva un entero de BPM.
constexpr unsigned long kNotifyIntervalMs = 1000;

HeartRateSensor heartRateSensor;
unsigned long lastNotifyAt = 0;

void setup() {
  Serial.begin(115200);

  if (!heartRateSensor.begin()) {
    Serial.println("MAX30102 no detectado - revisa el cableado I2C (SDA/SCL) y la alimentacion.");
    while (true) delay(1000);
  }

  bleHeartRateService.begin(kDeviceName);
  Serial.println("Physical Band lista - anunciandose por BLE como \"Physical Band\".");
}

void loop() {
  heartRateSensor.update();

  unsigned long now = millis();
  if (now - lastNotifyAt >= kNotifyIntervalMs) {
    lastNotifyAt = now;

    if (bleHeartRateService.isConnected()) {
      uint8_t bpm = heartRateSensor.fingerDetected() ? (uint8_t)heartRateSensor.bpm() : 0;
      bleHeartRateService.notifyHeartRate(bpm);
    }

    Serial.printf(
        "BPM=%d dedo=%s BLE=%s\n",
        heartRateSensor.bpm(),
        heartRateSensor.fingerDetected() ? "si" : "no",
        bleHeartRateService.isConnected() ? "conectado" : "anunciando");
  }
}
