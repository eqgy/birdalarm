// Stop button on the snooze Live Activity. Files in _shared are compiled into both the widget
// and the app: a LiveActivityIntent runs in the app's process, so the app needs it too.

import AlarmKit
import AppIntents
import Foundation

struct StopAlarmIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Stop alarm"
  static var description = IntentDescription("Stops the Dawn Chorus alarm.")
  // Only the Live Activity's button uses this; keep it out of Shortcuts and Siri.
  static var isDiscoverable: Bool = false

  @Parameter(title: "Alarm ID")
  var alarmID: String

  init(alarmID: String) {
    self.alarmID = alarmID
  }

  init() {
    self.alarmID = ""
  }

  func perform() async throws -> some IntentResult {
    if let id = UUID(uuidString: alarmID) {
      try AlarmManager.shared.stop(id: id)
    }
    return .result()
  }
}
