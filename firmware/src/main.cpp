#include <Arduino.h>
#include <Wire.h>

// Diagnóstico temporal de wiring I2C — NO es el firmware real de la banda
// (ese está respaldado, ver conversación). Objetivo: aislar cuál pin/línea
// está fallando cuando el MAX30102 no se detecta.
//
// 1) Lee el nivel crudo de SDA/SCL como GPIO digital plano, ANTES de tocar
//    Wire — si el pull-up (fijado por el jumper de la placa) llega bien a
//    3.3V, cada línea debe leer HIGH de forma estable en reposo. Una línea
//    que lee LOW o inestable señala esa línea específica (cable suelto, GND
//    flotante, o jumper en 1V8) — comparar SDA vs SCL aísla cuál de las dos.
// 2) Escanea las 127 direcciones I2C posibles, no sólo 0x57 (dirección del
//    MAX30102/MAX3010x) — si algo responde en cualquier dirección, el bus
//    en sí funciona eléctricamente y el problema es más específico
//    (mala dirección, sensor dañado, mal soldado en el propio chip).

constexpr int kSdaPin = 21;
constexpr int kSclPin = 22;

void checkLineLevels() {
  pinMode(kSdaPin, INPUT);
  pinMode(kSclPin, INPUT);
  delay(10);

  const int samples = 20;
  int sdaHigh = 0;
  int sclHigh = 0;
  for (int i = 0; i < samples; i++) {
    if (digitalRead(kSdaPin) == HIGH) sdaHigh++;
    if (digitalRead(kSclPin) == HIGH) sclHigh++;
    delay(5);
  }

  Serial.printf("SDA (GPIO%d): HIGH en %d/%d muestras%s\n", kSdaPin, sdaHigh, samples,
                sdaHigh == samples ? "  [OK - pull-up estable]" : "  [SOSPECHOSO]");
  Serial.printf("SCL (GPIO%d): HIGH en %d/%d muestras%s\n", kSclPin, sclHigh, samples,
                sclHigh == samples ? "  [OK - pull-up estable]" : "  [SOSPECHOSO]");
}

void scanI2C() {
  Wire.begin(kSdaPin, kSclPin);
  Serial.println("Escaneando bus I2C (direcciones 0x01-0x7E)...");
  int found = 0;
  for (uint8_t addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    uint8_t err = Wire.endTransmission();
    if (err == 0) {
      Serial.printf("  -> Dispositivo encontrado en 0x%02X%s\n", addr,
                     addr == 0x57 ? "  <-- dirección esperada del MAX30102" : "");
      found++;
    }
  }
  if (found == 0) Serial.println("  Ningun dispositivo respondio en ninguna direccion.");
}

void setup() {
  Serial.begin(115200);
  delay(1500);
  Serial.println();
  Serial.println("=== Diagnostico I2C MAX30102 (firmware temporal) ===");
  checkLineLevels();
  scanI2C();
  Serial.println("=== Fin del diagnostico inicial (se repite cada 5s) ===");
}

void loop() {
  delay(5000);
  Serial.println("--- Reescaneo ---");
  checkLineLevels();
  scanI2C();
}
