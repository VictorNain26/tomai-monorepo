module.exports = function (api) {
  api.cache(true);

  const plugins = [
    ['react-native-worklets/plugin', {}, 'react-native-worklets'],
    ['react-native-reanimated/plugin', {}, 'react-native-reanimated'],
  ];

  if (process.env.NODE_ENV === 'production') {
    plugins.push(['transform-remove-console', { exclude: ['error', 'warn'] }]);
  }

  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins,
  };
};
