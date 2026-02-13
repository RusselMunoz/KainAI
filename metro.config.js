// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Performance optimizations for faster bundling
config.transformer = {
  ...config.transformer,
  // Enable inline requires for lazy module loading
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
  // Enable minification only in production
  minifierConfig: {
    keep_classnames: false,
    keep_fnames: false,
    mangle: true,
    reserved: [],
    sourceMap: {
      includeSources: false,
    },
  },
};

// Improve resolver performance
config.resolver = {
  ...config.resolver,
  // Reduce the number of platforms Metro looks for
  platforms: ['android', 'ios'],
  // Cache symlinks resolution
  unstable_enableSymlinks: true,
};

// Enable caching for faster subsequent builds
config.cacheStores = config.cacheStores || [];

module.exports = config;
