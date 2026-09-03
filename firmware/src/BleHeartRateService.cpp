#include "BleHeartRateService.h"

#include <BLE2902.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>

namespace {

const BLEUUID kHeartRateServiceUuid((uint16_t)0x180D);
const BLEUUID kHeartRateMeasurementUuid((uint16_t)0x2A37);
const BLEUUID kBodySensorLocationUuid((uint16_t)0x2A38);

// Valores de "Body Sensor Location" definidos por el GATT Heart Rate Service
// spec — 0x03 = Wrist (muñeca), coherente con "banda" (ver Planeacion_proyecto.md).
constexpr uint8_t kBodySensorLocationWrist = 0x03;

}  // namespace

/** Reacciona a conexión/desconexión del cliente BLE (la app) para reanudar el advertising. */
class HeartRateServerCallbacks : public BLEServerCallbacks {
 public:
  explicit HeartRateServerCallbacks(BleHeartRateService* owner) : _owner(owner) {}

  void onConnect(BLEServer* server) override { _owner->setConnected(true); }

  void onDisconnect(BLEServer* server) override {
    _owner->setConnected(false);
    // Sin esto, el ESP-32 deja de anunciarse tras la primera desconexión y la
    // app nunca lo vuelve a encontrar sin reiniciar la banda físicamente.
    server->getAdvertising()->start();
  }

 private:
  BleHeartRateService* _owner;
};

void BleHeartRateService::begin(const char* deviceName) {
  BLEDevice::init(deviceName);

  BLEServer* server = BLEDevice::createServer();
  server->setCallbacks(new HeartRateServerCallbacks(this));

  BLEService* heartRateService = server->createService(kHeartRateServiceUuid);

  _heartRateMeasurementCharacteristic =
      heartRateService->createCharacteristic(kHeartRateMeasurementUuid, BLECharacteristic::PROPERTY_NOTIFY);
  // Client Characteristic Configuration Descriptor — sin este descriptor un
  // cliente BLE no tiene forma estándar de activar/desactivar notificaciones.
  _heartRateMeasurementCharacteristic->addDescriptor(new BLE2902());

  BLECharacteristic* bodySensorLocation =
      heartRateService->createCharacteristic(kBodySensorLocationUuid, BLECharacteristic::PROPERTY_READ);
  uint8_t location = kBodySensorLocationWrist;
  bodySensorLocation->setValue(&location, 1);

  heartRateService->start();

  BLEAdvertising* advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(kHeartRateServiceUuid);
  advertising->setScanResponse(true);
  BLEDevice::startAdvertising();
}

void BleHeartRateService::notifyHeartRate(uint8_t bpm) {
  if (!_connected || _heartRateMeasurementCharacteristic == nullptr) return;

  // Byte 0 = flags (0x00: BPM en UINT8, sin estado de contacto/energía/RR —
  // ver GATT Heart Rate Measurement spec). Byte 1 = BPM.
  uint8_t payload[2] = {0x00, bpm};
  _heartRateMeasurementCharacteristic->setValue(payload, sizeof(payload));
  _heartRateMeasurementCharacteristic->notify();
}

BleHeartRateService bleHeartRateService;
