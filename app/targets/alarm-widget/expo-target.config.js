// The Live Activity shown on the Lock Screen and in the Dynamic Island while an alarm rings
// or is snoozed. Built into the iPhone app by @bacons/apple-targets during prebuild.
/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'widget',
  name: 'AlarmWidget',
  displayName: 'Dawn Chorus',
  bundleIdentifier: '.alarmwidget',
  // AlarmKit (and its Live Activity types) only exist from iOS 26.
  deploymentTarget: '26.0',
  frameworks: ['SwiftUI', 'WidgetKit', 'ActivityKit', 'AlarmKit', 'AppIntents'],
  colors: {
    $accent: '#C9785E',
    $widgetBackground: '#0B1026',
  },
};
