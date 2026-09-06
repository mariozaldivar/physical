# Physical — firmware de la banda

Firmware base para la banda de pulso del prototipo (ver `../Planeacion_proyecto.md`
y `../Stack_tecnico_proyecto.md` §2). Lee el pulso con un sensor MAX30102 y lo
expone por BLE usando el **Heart Rate Service estándar del Bluetooth SIG**
(UUID `0x180D`, característica de medición `0x2A37`) — el mismo perfil que
usan bandas comerciales (Polar, Garmin, etc.), así que cualquier cliente BLE
que sepa leer ese perfil (incluida la app, vía `react-native-ble-plx`) se
conecta sin protocolo propio.

## Alcance de esta entrega

Esto es la **base**: lectura de pulso + conexión BLE, pedidas explícitamente
en `INSTRUCCIONES.md` (archivada en `../instructions_archive/` — ver el repo
raíz). No incluye: gestión de batería/deep sleep, SpO2 (el sensor lo soporta,
pero no se pidió), ni un LED de estado (para no asumir a qué GPIO está
cableado uno en la placa específica que se termine comprando).

**No se pudo compilar/flashear en esta sesión** — no hay PlatformIO instalado
en este entorno ni hardware ESP-32/MAX30102 conectado para probar. El código
está escrito y revisado contra la documentación oficial y los ejemplos
verificados de las librerías usadas (ver más abajo), pero la primera
compilación real y la prueba con el sensor físico quedan pendientes para
cuando el usuario tenga el hardware a mano.

## Wiring (MAX30102, I2C)

| MAX30102 | ESP-32 (DevKitC genérico) |
| -------- | ------------------------- |
| VIN      | 3.3V                      |
| GND      | GND                       |
| SDA      | GPIO21 (I2C SDA por defecto) |
| SCL      | GPIO22 (I2C SCL por defecto) |

Estos son los pines I2C por defecto que usa `Wire.begin()` sin argumentos en
la mayoría de las placas ESP-32 DevKitC. Si tu placa específica los tiene en
otro lado, remapea con `Wire.begin(sda, scl)` en `HeartRateSensor::begin()`
(`src/HeartRateSensor.cpp`).

## Build / flash

Requiere [PlatformIO](https://platformio.org/) (extensión de VS Code, o el
CLI `pio`).

```bash
cd firmware
pio run                 # compila
pio run --target upload # compila y flashea (ESP-32 conectado por USB)
pio device monitor      # monitor serial a 115200 baud
```

El `env` por defecto (`esp32dev`) apunta a un DevKitC genérico
(`board = esp32dev` en `platformio.ini`). Si tu placa es otro modelo, cambia
`board` — `pio boards espressif32` lista las opciones.

## Verificar que funciona

1. Al encender, si el sensor no se detecta (wiring/alimentación), el monitor
   serial imprime un error y el firmware se detiene ahí (no sigue con datos
   basura).
2. Con el sensor detectado, el monitor serial imprime cada segundo algo como:
   `BPM=0 dedo=no BLE=anunciando`.
3. Al poner el dedo índice sobre el sensor con presión firme y constante,
   `dedo` pasa a `si` y `BPM` empieza a mostrar un valor una vez que el
   algoritmo detecta suficientes latidos consecutivos para promediar (unos
   pocos segundos).
4. Con un scanner BLE genérico (nRF Connect, LightBlue, etc.) o la app
   Physical (ver `app/src/services/bleHeartRateService.native.ts`, todavía no
   conectada al flujo principal — ver nota ahí), la banda debe aparecer
   anunciándose como **"Physical Band"** con el servicio `0x180D`. Al
   conectarse, `BLE` pasa a `conectado` y el characteristic de medición
   empieza a notificar el BPM cada segundo.

## Estructura

```
firmware/
├── platformio.ini
├── include/
│   ├── HeartRateSensor.h      — wrapper del sensor MAX30102 + algoritmo de BPM
│   └── BleHeartRateService.h  — servidor BLE (Heart Rate Service estándar)
└── src/
    ├── HeartRateSensor.cpp
    ├── BleHeartRateService.cpp
    └── main.cpp                — setup()/loop(), une sensor + BLE
```

## Librerías usadas (y por qué)

- **[SparkFun MAX3010x Pulse and Proximity Sensor Library](https://github.com/sparkfun/SparkFun_MAX3010x_Sensor_Library)**
  (`lib_deps` en `platformio.ini`) — driver oficial del sensor. El algoritmo
  de detección de latidos (`checkForBeat`, en `HeartRateSensor::update()`) es
  el mismo que usa el ejemplo oficial `Example5_HeartRate` de esta librería
  (verificado contra el código fuente real del repo, no adivinado): detecta
  picos en la señal IR, calcula el BPM instantáneo por el intervalo entre
  picos, y lo promedia sobre las últimas 4 lecturas para suavizar ruido.
- **BLE del framework Arduino de ESP-32** (`BLEDevice.h`, `BLEServer.h`,
  `BLE2902.h`) — ya viene con `framework = arduino` en `platformio.ini`, no
  es una dependencia aparte.

## Próximos pasos (fuera de esta entrega)

- Conseguir/armar el hardware físico (ver presupuesto en `../Planeacion_proyecto.md`).
- Primera compilación y prueba real con el sensor.
- Conectar `app/src/services/bleHeartRateService.native.ts` al flujo principal
  de la app una vez que haya banda física con la que probar el handshake —
  ver el comentario al inicio de ese archivo.
