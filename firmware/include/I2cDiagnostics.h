#pragma once

#include <Arduino.h>

/**
 * Diagnóstico del bus I2C, para cuando el sensor no se detecta. Imprime por
 * Serial lo suficiente para distinguir las causas típicas entre sí en vez de
 * dejar sólo un "no detectado":
 *
 *  - Una línea (SDA o SCL) que no está estable en HIGH en reposo señala esa
 *    línea en concreto: cable suelto, soldadura fría, o GND flotando.
 *  - Un escaneo de las 127 direcciones que no encuentra nada dice que el bus
 *    está eléctricamente muerto; si aparece algo en 0x57 (dirección del
 *    MAX30102) pero el sensor sigue sin inicializar, el cableado está bien y
 *    el problema es del chip.
 */
void printI2cDiagnostics(int sdaPin, int sclPin);
