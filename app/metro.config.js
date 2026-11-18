const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
// The shared alarm logic lives outside the app folder.
config.watchFolders = [path.resolve(__dirname, '../shared/src')];
module.exports = config;
