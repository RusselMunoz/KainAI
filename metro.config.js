// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

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
      // Enable non-dev mode optimizations even during dev
      nonInlinedRequires: [
        'React',
        'react',
        'react-native',
      ],
    },
  }),
  // Minifier configuration for production builds
  minifierPath: 'metro-minify-terser',
  minifierConfig: {
    keep_classnames: false,
    keep_fnames: false,
    mangle: {
      toplevel: true,
    },
    compress: {
      drop_console: process.env.NODE_ENV === 'production',
      passes: 2,
    },
    output: {
      comments: false,
    },
  },
  // Async requires for code splitting
  asyncRequireModulePath: require.resolve('metro-runtime/src/modules/asyncRequire'),
};

// Improve resolver performance
config.resolver = {
  ...config.resolver,
  // Reduce the number of platforms Metro looks for
  platforms: ['android', 'ios'],
  // Cache symlinks resolution
  unstable_enableSymlinks: true,
  // Prioritize resolver main fields for faster resolution
  resolverMainFields: ['react-native', 'browser', 'main'],
  // Replace heavy optional dependencies with lightweight stubs
  extraNodeModules: {
    ...(config.resolver?.extraNodeModules || {}),
    'react-native-zoom-reanimated': path.resolve(
      __dirname,
      'stubs/react-native-zoom-reanimated'
    ),
  },
  // Block known large unused modules from being included
  blockList: [
    // Block any test files from the bundle
    /.*\/__tests__\/.*/,
    /.*\.test\.[jt]sx?$/,
    /.*\.spec\.[jt]sx?$/,
  ],
};

// Enable caching for faster subsequent builds
config.cacheStores = config.cacheStores || [];

// Increase max workers for parallel processing
config.maxWorkers = process.env.CI ? 2 : Math.max(2, require('os').cpus().length - 1);

// Reset cache on significant changes
config.resetCache = process.env.METRO_RESET_CACHE === 'true';

module.exports = config;
