#!/usr/bin/env bash
# esp-setup — da acceso al puerto serial del ESP-32 antes de compilar/flashear.
#
# /dev/ttyUSB0 pertenece a root:uucp y esta cuenta no está en ese grupo, así
# que pio (esptool) no puede abrir el puerto sin esto. Cambia el dueño del
# dispositivo (efecto temporal: se resetea al desconectar el ESP-32) en vez
# de meter al usuario en el grupo uucp de forma permanente.
#
# Uso: ./esp-setup.sh   (o "pio run --target upload" fallará con Permission denied)

set -euo pipefail

PORT="${1:-/dev/ttyUSB0}"

if [ ! -e "$PORT" ]; then
  echo "No se encontró $PORT — ¿está el ESP-32 conectado por USB-C?" >&2
  exit 1
fi

sudo chown "$USER:$USER" "$PORT"
echo "Listo — $PORT accesible sin sudo hasta que desconectes el ESP-32."
