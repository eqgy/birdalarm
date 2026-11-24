// Widgets: the Live Activity shown while an alarm rings or is snoozed, and the Lock Screen /
// Home Screen bird widget. Built into the iPhone app by @bacons/apple-targets during prebuild.
const fs = require('fs');
const path = require('path');

// Square 300px photos of each bird (made by pipeline/make_widget_photos.py), bundled into the
// widget as image assets named by bird id, e.g. Image("wood-thrush").
const birdsDir = path.join(__dirname, 'birds');
const images = Object.fromEntries(
  fs.existsSync(birdsDir)
    ? fs.readdirSync(birdsDir).filter((f) => f.endsWith('.jpg')).map((f) => [path.basename(f, '.jpg'), `./birds/${f}`])
    : [],
);

/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'widget',
  name: 'AlarmWidget',
  displayName: 'Dawn Chorus',
  bundleIdentifier: '.alarmwidget',
  // AlarmKit (and its Live Activity types) only exist from iOS 26.
  deploymentTarget: '26.0',
  frameworks: ['SwiftUI', 'WidgetKit', 'ActivityKit', 'AlarmKit', 'AppIntents'],
  // Same App Group as the app, which writes the widget's data there (src/state/widget-sync.ts).
  entitlements: {
    'com.apple.security.application-groups': ['group.io.github.dawnchorus.app'],
  },
  colors: {
    $accent: '#C9785E',
    $widgetBackground: '#0B1026',
  },
  images,
};
