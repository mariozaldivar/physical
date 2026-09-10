# Acceso al puerto serial del ESP-32 para flashear/monitorear

**Qué se cambió:** permiso temporal sobre el dispositivo serial, ejecutado por el usuario:
```
sudo chmod 666 /dev/ttyUSB0
```

**Por qué:** `/dev/ttyUSB0` (adaptador CH340 del ESP-32) pertenece a `root:uucp` con permisos
`crw-rw----`, y la cuenta `Mario` no está en el grupo `uucp` — sin esto, `pio run --target upload`
y cualquier lectura del monitor serial fallan por permisos. Se eligió el `chmod` puntual sobre
`usermod -aG uucp` porque no es persistente y no requiere cerrar sesión.

**Alcance/implicaciones:** mientras dure, *cualquier* proceso del sistema puede leer/escribir ese
puerto. Es efímero: el nodo `/dev/ttyUSB0` se recrea con sus permisos originales (`root:uucp`,
`crw-rw----`) al desconectar y reconectar el ESP-32, o al reiniciar. No toca `/etc`, ni reglas
udev, ni grupos del usuario.

**Cómo replicarlo:** con el ESP-32 conectado, `ls -l /dev/ttyUSB0` para confirmar el nodo, y correr
el `chmod` de arriba. Hay que repetirlo cada vez que se reconecte físicamente la placa.

**Cómo revertirlo:** `sudo chmod 660 /dev/ttyUSB0`, o simplemente desconectar y reconectar el
ESP-32. Para volverlo permanente en su lugar (no se hizo): `sudo usermod -aG uucp Mario` + cerrar
y volver a iniciar sesión.

**Nota aparte (no es cambio de sistema):** `pio device monitor` no funciona desde una sesión sin
TTY — falla con `termios.error: (25, 'Inappropriate ioctl for device')`. Para leer el serial de
forma no interactiva hay que usar `pyserial` directo
(`serial.Serial('/dev/ttyUSB0', 115200)`), no el monitor de PlatformIO.
