module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // react-native-reanimated 4.x mueve su plugin de babel a react-native-worklets;
    // debe ir último en la lista (requisito de la librería).
    plugins: ["react-native-worklets/plugin"],
  };
};
