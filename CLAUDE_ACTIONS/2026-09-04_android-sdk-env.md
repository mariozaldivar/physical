# Exportar ANDROID_HOME/ANDROID_SDK_ROOT en el shell

**Qué se cambió:** se agregó a `~/.zshrc`:
```
export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
```
También se creó `Physical/app/android/local.properties` (gitignored, no versionado) con
`sdk.dir=/home/Mario/Android/Sdk`, para desbloquear el build en la sesión de terminal actual
sin esperar a que se recargue `~/.zshrc`.

**Por qué:** `./gradlew assembleDebug` fallaba con
`SDK location not found. Define a valid SDK location with an ANDROID_HOME environment
variable or by setting the sdk.dir path in your project's local properties file`.
El SDK ya estaba instalado en `/home/Mario/Android/Sdk` (ver `Physical/app` memoria de build),
pero no estaba en el `PATH`/entorno del shell, y `android/` se regenera con `expo prebuild`
(está en `.gitignore`) por lo que `local.properties` no persiste solo.

**Alcance/implicaciones:** afecta a cualquier terminal nueva de este usuario en esta máquina
(no solo `Physical/app`) — cualquier herramienta que lea `ANDROID_HOME`/`ANDROID_SDK_ROOT`
(Gradle, adb, otras apps Android) ahora los encuentra. No modifica el SDK en sí ni ningún
archivo versionado del repo.

**Cómo replicarlo en otra máquina:** confirmar la ruta real del SDK instalado
(`echo $ANDROID_HOME` si Android Studio ya lo configuró, o buscar `Android/Sdk` en el home) y
agregar las mismas 3 líneas a `~/.zshrc` (o `~/.bashrc` si el shell es bash), apuntando a esa ruta.

**Cómo revertirlo:** borrar las 3 líneas agregadas en `~/.zshrc` (bloque que empieza en
`export ANDROID_HOME=...`). Los builds de Android volverán a fallar con el mismo error hasta
que se exporte `ANDROID_HOME` a mano o se reponga esta config. Borrar
`Physical/app/android/local.properties` no tiene efecto persistente: se regenera (o falta)
cada vez que corre `expo prebuild`.
