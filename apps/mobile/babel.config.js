module.exports = function (api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
    // Note: react-native-reanimated/plugin is auto-included by babel-preset-expo
    // Note: React Compiler disabled — incompatible with Expo Router (expo#35100)
    // Re-enable when https://github.com/expo/expo/issues/35100 is fixed
  };
};
