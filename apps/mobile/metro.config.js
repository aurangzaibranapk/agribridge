const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, "../../src/lib")];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, "node_modules")];
config.resolver.disableHierarchicalLookup = true;
config.resolver.blockList = [
  /[/\\]src[/\\]lib[/\\]mobile[/\\]server-sync\.ts$/,
  /[/\\]src[/\\]lib[/\\]mobile[/\\]whatsapp-config\.ts$/,
  /[/\\]src[/\\]lib[/\\]product-version\.ts$/,
  /[/\\]src[/\\](app|actions|lib[/\\]supabase)[/\\].*/,
];
config.transformer = { ...config.transformer, inlineRequires: true };

module.exports = config;
