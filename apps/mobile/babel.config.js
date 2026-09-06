module.exports = function babelConfig(api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
    plugins: [
      // Reanimated's plugin has to be last.
      'react-native-reanimated/plugin',
    ],
  };
};
