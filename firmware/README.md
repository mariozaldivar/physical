# Physical — firmware de la banda

Firmware base para la banda de pulso del prototipo (ver `../Planeacion_proyecto.md`
y `../Stack_tecnico_proyecto.md` §2). Lee el pulso con un sensor MAX30102 y lo
expone por BLE usando el **Heart Rate Service estándar del Bluetooth SIG**
(UUID `0x180D`, característica de medición `0x2A37`) — el mismo perfil que
usan bandas comerciales (Polar, Garmin, etc.), así que cualquier cliente BLE
que sepa leer ese perfil (incluida la app, vía `react-native-ble-plx`) se
conecta sin protocolo propio.

## Alcance de esta entrega

Lectura de pulso + conexión BLE + **autodiagnóstico del sensor**. No incluye:
gestión de batería/deep sleep, SpO2 (el sensor lo soporta, pero no se pidió),
ni un LED de estado (para no asumir a qué GPIO está cableado uno en la placa
específica que se termine comprando).

**El BLE arranca siempre, haya sensor o no.** Es la diferencia principal
contra la versión anterior del firmware, que hacía `while (true)` si el
MAX30102 no respondía y por lo tanto nunca llegaba a encender el BLE — justo
el escenario de un sensor mal soldado, en el que uno más necesita que la
banda siga hablando para saber qué le pasa. Ahora el estado del sensor es un
dato que se reporta (por Serial y por BLE), no una condición para arrancar,
así que este mismo firmware sirve para verificar si el cableado/soldadura
quedó bien.

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

**Sólo se usan 4 pines** (`VIN`, `GND`, `SDA`, `SCL`). El breakout típico de
MAX30102 (como el que trae este proyecto) también expone `INT` y, en el
reverso, test points `RD`/`IRD` (cátodos de los LEDs rojo/infrarrojo) —
ninguno se conecta: `INT` no se usa porque el firmware lee el sensor por
polling en `loop()` (no por interrupción), y `RD`/`IRD` son sólo para
depuración analógica.

**Jumper de voltaje de pull-up (reverso de la placa, marcado `1V8`/`3V3`
junto a `VIN`/`SDA`/`SCL`/`GND`/`3V3`): debe quedar soldado en `3V3`, no en
`1V8`.** Ese jumper fija el voltaje al que quedan las resistencias pull-up
del bus I2C. El ESP-32 opera I2C a 3.3V lógicos — con el jumper en `1V8` el
nivel alto del bus queda en ~1.8V, por debajo del umbral de "alto" que el
ESP-32 necesita para leerlo de forma confiable, y el sensor no será
detectado (mismo síntoma que un wiring SDA/SCL incorrecto). Revisar esto
primero si `begin()` falla con el wiring de la tabla ya verificado.

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

El monitor serial (115200 baud) imprime una línea de estado por segundo con
uno de estos tres estados:

| Línea serial | Qué significa |
| --- | --- |
| `[SENSOR NO DETECTADO] BPM=0 BLE=...` | El MAX30102 no responde en el bus I2C: mal soldado, cable suelto, sin alimentación, o jumper de pull-up en `1V8` (ver Wiring). |
| `[sensor OK - sin contacto] BPM=0 BLE=...` | El sensor responde, pero no hay dedo/muñeca encima. |
| `[sensor OK - midiendo] BPM=72 BLE=...` | Hay contacto y el BPM es real. |

1. **Si el sensor no se detecta**, cada 3 s se imprime además un diagnóstico
   del bus I2C y se reintenta la detección — se puede corregir la soldadura
   con la banda encendida y ver el momento exacto en que empieza a responder,
   sin reflashear. El diagnóstico distingue las causas entre sí:
   - `SDA`/`SCL` marcadas `[SOSPECHOSO]` (no leen HIGH estable en reposo) →
     el problema está en esa línea concreta o en la alimentación/GND.
   - Ambas `[OK]` pero *"Ningun dispositivo responde en el bus"* → las líneas
     llegan bien pero el chip no contesta (soldadura del propio MAX30102).
   - `Responde 0x57` y aun así no inicializa → el cableado está bien, sospechar
     del chip.
2. **Con el sensor detectado**, poner el dedo índice encima con presión firme
   y constante: el estado pasa a `midiendo` y el BPM aparece tras unos
   segundos (el algoritmo necesita varios latidos consecutivos para promediar).
3. **Por BLE**, con un scanner genérico (nRF Connect, LightBlue) o la app
   Physical (`app/src/services/bleHeartRateService.native.ts`), la banda
   aparece como **"Physical Band"** con el servicio `0x180D`. Al conectarse,
   `BLE` pasa a `conectado` y el characteristic `0x2A37` notifica cada segundo.
4. **El estado del sensor también viaja por BLE**, sin protocolo propio: va en
   los bits de *Sensor Contact* del flags byte estándar del Heart Rate
   Measurement, así que se lee desde cualquier cliente del perfil.

   | Flags byte | Estado |
   | --- | --- |
   | `0x00` | Sensor no detectado (la banda no puede informar contacto) |
   | `0x04` | Sensor OK, sin contacto |
   | `0x06` | Sensor OK, con contacto — el BPM del byte 1 es real |

   Fuera del estado `0x06` el BPM notificado es siempre `0`, para que la app
   nunca muestre un valor viejo como si fuera una medición en curso.

5. El sensor se revalida cada 2 s mientras mide (lectura del PART ID): si se
   suelta a media sesión, el estado vuelve a `SENSOR NO DETECTADO` en vez de
   dejar el último BPM congelado.

## Estructura

```
firmware/
├── platformio.ini
├── include/
│   ├── HeartRateSensor.h      — wrapper del sensor MAX30102 + algoritmo de BPM
│   ├── BleHeartRateService.h  — servidor BLE (Heart Rate Service estándar)
│   └── I2cDiagnostics.h       — diagnóstico del bus cuando el sensor no aparece
└── src/
    ├── HeartRateSensor.cpp
    ├── BleHeartRateService.cpp
    ├── I2cDiagnostics.cpp
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
- Prueba real con el sensor bien soldado (a la fecha del flasheo, el MAX30102
  no respondía en el bus — el firmware lo reporta como `SENSOR NO DETECTADO`).
- Conectar `app/src/services/bleHeartRateService.native.ts` al flujo principal
  de la app una vez que haya banda física con la que probar el handshake —
  ver el comentario al inicio de ese archivo.
