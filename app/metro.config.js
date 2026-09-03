// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// expo-sqlite en web carga su motor (wa-sqlite) como WASM — sin esto, Metro no
// sabe resolver `wa-sqlite.wasm` y el bundle entero de web falla al buildear
// (afecta a TODA la app, no sólo a las pantallas que usan la DB, porque
// db.ts se importa transitivamente desde el entry point). Ver
// https://docs.expo.dev/versions/latest/sdk/sqlite/#usage-on-the-web
// y el punto abierto #4 de app/Informe_retrieval_datos.md.
config.resolver.assetExts.push("wasm");

module.exports = config;
