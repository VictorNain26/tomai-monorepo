module.exports = function (api) {
  api.cache(true);

  return {
    presets: [
      [
        'babel-preset-expo',
        {
          // React Compiler — configured via preset (NOT as a standalone plugin)
          // @see https://docs.expo.dev/guides/react-compiler/
          'react-compiler': {
            compilationMode: 'infer',
            // 'none' = skip components that fail compilation (try/finally, etc.)
            // This is the recommended default for production apps
            panicThreshold: 'none',
          },
        },
      ],
    ],
    plugins: [
      // Note: react-native-reanimated/plugin is auto-included by babel-preset-expo
      // Note: transform-remove-console is handled by babel-preset-expo in production
    ],
  };
};
