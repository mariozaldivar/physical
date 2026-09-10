#include "I2cDiagnostics.h"

#include <Wire.h>

namespace {

// Dirección I2C fija del MAX30102/MAX3010x.
constexpr uint8_t kMax3010xAddress = 0x57;

// Lee las líneas como GPIO plano, antes de tocar Wire: en reposo, con los
// pull-ups del breakout alimentados a 3.3V, ambas deben leer HIGH estable.
void printLineLevels(int sdaPin, int sclPin) {
  pinMode(sdaPin, INPUT);
  pinMode(sclPin, INPUT);
  delay(10);

  constexpr int kSamples = 20;
  int sdaHigh = 0;
  int sclHigh = 0;
  for (int i = 0; i < kSamples; i++) {
    if (digitalRead(sdaPin) == HIGH) sdaHigh++;
    if (digitalRead(sclPin) == HIGH) sclHigh++;
    delay(5);
  }

  Serial.printf("  SDA (GPIO%d): HIGH en %d/%d muestras %s\n", sdaPin, sdaHigh, kSamples,
                sdaHigh == kSamples ? "[OK - pull-up estable]" : "[SOSPECHOSO]");
  Serial.printf("  SCL (GPIO%d): HIGH en %d/%d muestras %s\n", sclPin, sclHigh, kSamples,
                sclHigh == kSamples ? "[OK - pull-up estable]" : "[SOSPECHOSO]");
}

void printBusScan(int sdaPin, int sclPin) {
  Wire.begin(sdaPin, sclPin);

  int found = 0;
  for (uint8_t addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.printf("  -> Responde 0x%02X%s\n", addr,
                    addr == kMax3010xAddress ? "  <-- direccion esperada del MAX30102" : "");
      found++;
    }
  }
  if (found == 0) {
    Serial.println("  -> Ningun dispositivo responde en el bus (revisa VIN/GND/SDA/SCL).");
  }
}

}  // namespace

void printI2cDiagnostics(int sdaPin, int sclPin) {
  Serial.println("Diagnostico I2C:");
  printLineLevels(sdaPin, sclPin);
  printBusScan(sdaPin, sclPin);
}
