const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Bundle the local pdf.js library as a plain-text asset so PDF import works
// fully offline instead of fetching pdf.js from a CDN at runtime.
config.resolver.assetExts.push("txt");

module.exports = config;
