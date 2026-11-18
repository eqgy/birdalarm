Pod::Spec.new do |s|
  s.name           = 'DawnAlarm'
  s.version        = '0.1.0'
  s.summary        = 'Schedules Dawn Chorus wake-up alarms with AlarmKit.'
  s.description    = 'Local Expo module wrapping AlarmKit (iOS 26+) for the Dawn Chorus app.'
  s.author         = 'Dawn Chorus contributors'
  s.homepage       = 'https://github.com/'
  s.license        = 'MIT'
  s.platforms      = { :ios => '26.0' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,mm,swift}'
end
