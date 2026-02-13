module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Enable reanimated plugin for performance (must be last)
      'react-native-reanimated/plugin',
    ],
    env: {
      production: {
        plugins: [
          // Remove console.log statements in production for better performance
          'transform-remove-console',
        ],
      },
    },
  };
};
