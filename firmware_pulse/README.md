# Firmware — variante Pulse Sensor Amped

Variante analógica del firmware de la banda. La variante original con
MAX30102 (I2C) sigue intacta en [`../firmware`](../firmware) — este proyecto
es independiente: su propio `platformio.ini`, su propio `src/`. Flashear uno
sobreescribe al otro en la placa, pero los fuentes no se tocan entre sí.

La capa BLE (`BleHeartRateService.{h,cpp}`) es copia literal de la otra
variante: el Heart Rate Service 0x180D no cambia, así que la app no necesita
ningún cambio. Si se corrige un bug ahí, hay que copiarlo a mano a la otra.

## Wiring (Pulse Sensor Amped)

| Pulse Sensor Amped | ESP-32 (DevKitC genérico) |
| ------------------ | ------------------------- |
| Rojo — VCC         | **3.3V (NO 5V)**          |
| Negro — GND        | GND                       |
| Morado — Signal    | GPIO34                    |

**El cable rojo va a 3.3V, nunca a 5V.** La salida del Amped se polariza en
VCC/2 y oscila alrededor: alimentado a 5V, esa señal supera los 3.3V que
tolera el ADC del ESP-32 y **daña el pin**. Alimentado a 3.3V la amplitud es
menor pero está dentro de rango.

**GPIO34 es de ADC1.** ADC2 (GPIO 0, 2, 4, 12-15, 25-27) queda descartado:
el driver de WiFi se lo apropia y con BLE encendido su comportamiento no está
garantizado. ADC1 son GPIO32-39 y siempre funcionan. Para cambiar de pin,
`kSignalPin` en `include/HeartRateSensor.h` — que sea otro ADC1.

GPIO34 es input-only y no tiene pull-up interno; da igual, sólo se lee como
entrada analógica.

## Cómo se detecta el latido

El ADC se lee a 500 Hz. Se sigue la envolvente de la señal (pico y valle, que
se encogen un 25% cada 500 ms para adaptarse) y el umbral se pone al 55% de
esa envolvente. Cada cruce de subida por encima del umbral, con al menos
300 ms desde el anterior (tope de 200 BPM, evita contar la onda dicrota como
un segundo latido), cuenta como latido. El BPM se promedia sobre los últimos
4 intervalos.

## Diferencia de comportamiento contra la variante MAX30102

Un sensor analógico **no hace ACK ni tiene registro PART ID**, así que la
presencia del sensor ya no se puede saber con certeza — sólo estimar. Aquí
`detect()` comprueba que el pin esté polarizado en una banda plausible
(DC entre 700 y 3500 en cuentas de 12 bits, es decir cerca de VCC/2). Un pin
al aire normalmente no se queda ahí, pero puede hacerlo por casualidad: el
estado `SensorStatus::NotDetected` que se reporta por BLE es ahora una
heurística, no la certeza que daba el bus I2C.

El contacto (`NoContact` vs `Measuring`) se decide por amplitud pico-a-pico:
sin dedo la señal es casi plana, con dedo son cientos de cuentas. El umbral
es `kContactAmplitude` (150 por defecto) en `include/HeartRateSensor.h`.

## Build / flash

```bash
cd firmware_pulse
pio run                 # compila
pio run --target upload # compila y flashea
```

En Arch, `/dev/ttyUSB0` es `root:uucp` y hay que dar permiso cada vez que se
reconecta físicamente la placa: `sudo chmod 666 /dev/ttyUSB0`
(ver `CLAUDE_ACTIONS/2026-09-07_acceso-serial-esp32.md`).

`pio device monitor` no funciona sin TTY; para leer el serial de forma no
interactiva, `pyserial` directo a 115200 baud.

## Verificar que funciona

Al arrancar debe imprimir:

```
=== Physical Band (Pulse Sensor Amped) ===
BLE activo - anunciandose como "Physical Band" (Heart Rate Service 0x180D).
Pulse Sensor detectado.
[sensor OK - sin contacto] BPM=0 BLE=anunciando
```

Con el dedo apoyado (sin apretar) debe pasar a `[sensor OK - midiendo]` con un
BPM plausible en 2-3 segundos.

Si sale `SENSOR NO DETECTADO`, cada 3 s imprime el diagnóstico analógico con
el nivel DC leído — sirve para arreglar la soldadura con la banda encendida y
ver en vivo cuándo empieza a responder, sin reflashear. Ese mismo diagnóstico
imprime la amplitud pico-a-pico, que es con lo que se calibra
`kContactAmplitude` si 150 resulta demasiado alto o bajo.

## Calibración

Si el contacto no se detecta (se queda en `sin contacto` con el dedo puesto) o
al revés (marca `midiendo` sin dedo), leer la amplitud que reporta el
diagnóstico en ambos casos y poner `kContactAmplitude` a medio camino.

Si el BPM sale al doble del real, el umbral está contando la onda dicrota:
subir `kThresholdPercent`. Si sale a la mitad, bajarlo.
