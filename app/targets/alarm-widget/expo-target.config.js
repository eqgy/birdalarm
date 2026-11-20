// Widgets: the Live Activity shown while an alarm rings or is snoozed, and the Lock Screen /
// Home Screen bird widget (today's bird and the next alarm). Built into the iPhone app by @bacons/apple-targets during prebuild.
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
};
