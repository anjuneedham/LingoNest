// Metro configuration for the monorepo: the app imports @lingonest/core and
// @lingonest/content directly from source, so Metro has to watch the whole
// workspace and resolve modules from both node_modules trees.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

// Package-exports resolution picks some dependencies' ESM build (their
// "import" condition) over the CJS one Metro can actually bundle safely for
// every platform — zustand's ESM middleware bundle contains a bare
// `import.meta` reference that is a hard parse error once Metro serves it as
// a classic (non-module) script on web. The legacy main/browser-field
// resolution these packages also ship does not have that problem.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
