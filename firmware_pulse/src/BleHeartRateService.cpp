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

void BleHeartRateService::notifyHeartRate(uint8_t bpm, SensorStatus status) {
  if (!_connected || _heartRateMeasurementCharacteristic == nullptr) return;

  // Byte 0 = flags del GATT Heart Rate Measurement. Bit 0 = 0 (BPM en UINT8).
  // Bit 2 = "Sensor Contact Supported", bit 1 = "Sensor Contact Detected".
  // Esos dos bits son el mecanismo estándar para decir en qué estado está el
  // sensor, y dan justo los tres casos que necesitamos sin inventar nada:
  //
  //   0x00 -> la banda no puede informar contacto = no hay sensor en el bus.
  //   0x04 -> puede informarlo y NO hay contacto (sensor OK, sin dedo).
  //   0x06 -> puede informarlo y SÍ hay contacto (el BPM es real).
  //
  // Byte 1 = BPM.
  uint8_t flags = 0x00;
  switch (status) {
    case SensorStatus::NotDetected: flags = 0x00; break;
    case SensorStatus::NoContact:   flags = 0x04; break;
    case SensorStatus::Measuring:   flags = 0x06; break;
  }
  if (status != SensorStatus::Measuring) bpm = 0;

  uint8_t payload[2] = {flags, bpm};
  _heartRateMeasurementCharacteristic->setValue(payload, sizeof(payload));
  _heartRateMeasurementCharacteristic->notify();
}

BleHeartRateService bleHeartRateService;
