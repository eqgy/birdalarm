// Dawn Chorus alarm module: a thin wrapper over AlarmKit (iOS 26+).
//
// The app's shared TypeScript queue decides which alarms should exist. Each time it changes,
// JS calls replaceAll() with the full list, and this module cancels every alarm the app has
// with AlarmKit and schedules the list again. That keeps AlarmKit and the app's saved state
// from drifting apart, at the cost of re-scheduling ~28 alarms, which is cheap.
//
// Alarm ids from JS are strings like "main:2026-11-18". AlarmKit wants UUIDs, so each string
// is hashed into a stable UUID.
//
// Snooze: when snoozeMinutes > 0 the alert gets a Snooze button that starts an AlarmKit
// countdown, then rings again. The countdown is drawn by the Live Activity in
// targets/alarm-widget (AlarmKit requires one for countdowns).

import ActivityKit
import AlarmKit
import CryptoKit
import ExpoModulesCore
import SwiftUI

/// Must match the struct of the same name in targets/alarm-widget/AlarmLiveActivity.swift,
/// so the widget can read it.
struct DawnAlarmMetadata: AlarmMetadata {
  var birdName: String = ""
}

struct AlarmRequest: Record {
  @Field var id: String = ""
  /// Epoch milliseconds.
  @Field var fireAt: Double = 0
  /// Title shown on the Lock Screen and in the Dynamic Island.
  @Field var title: String = "Good morning"
  /// Exact filename of a sound in the app bundle, e.g. "american-robin.caf". Nil = system sound.
  @Field var sound: String? = nil
  /// The bird dealt to this morning, shown on the Live Activity while snoozing.
  @Field var birdName: String = ""
  /// Minutes Snooze waits before ringing again. 0 = no Snooze button.
  @Field var snoozeMinutes: Double = 0
}

final class AlarmKitDeniedException: Exception {
  override var reason: String {
    "Alarms aren't allowed. Turn them on in Settings > Apps > Dawn Chorus."
  }
}

public class DawnAlarmModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DawnAlarm")

    /// "notDetermined" | "authorized" | "denied"
    AsyncFunction("authorizationStatus") { () -> String in
      Self.stateName(AlarmManager.shared.authorizationState)
    }

    AsyncFunction("requestAuthorization") { () async throws -> String in
      let state = try await AlarmManager.shared.requestAuthorization()
      return Self.stateName(state)
    }

    /// Cancel every alarm this app has scheduled, then schedule `alarms`.
    /// Returns how many were scheduled.
    AsyncFunction("replaceAll") { (alarms: [AlarmRequest]) async throws -> Int in
      var state = AlarmManager.shared.authorizationState
      if state == .notDetermined {
        state = try await AlarmManager.shared.requestAuthorization()
      }
      guard state == .authorized else { throw AlarmKitDeniedException() }

      for existing in try AlarmManager.shared.alarms {
        try? AlarmManager.shared.cancel(id: existing.id)
      }

      let now = Date()
      var scheduled = 0
      for request in alarms {
        let date = Date(timeIntervalSince1970: request.fireAt / 1000)
        guard date > now else { continue }
        try await Self.schedule(request, at: date)
        scheduled += 1
      }
      return scheduled
    }

    /// Ids (UUID strings) and fire dates of everything currently scheduled, for debugging.
    AsyncFunction("listAlarms") { () throws -> [[String: Any]] in
      try AlarmManager.shared.alarms.map { alarm in
        var entry: [String: Any] = ["uuid": alarm.id.uuidString]
        if case .fixed(let date)? = alarm.schedule {
          entry["fireAt"] = date.timeIntervalSince1970 * 1000
        }
        return entry
      }
    }

    AsyncFunction("cancelAll") { () throws in
      for existing in try AlarmManager.shared.alarms {
        try? AlarmManager.shared.cancel(id: existing.id)
      }
    }
  }

  private static func schedule(_ request: AlarmRequest, at date: Date) async throws {
    let stopButton = AlarmButton(
      text: LocalizedStringResource(stringLiteral: "Stop"),
      textColor: .white,
      systemImageName: "stop.circle")
    let title = LocalizedStringResource(stringLiteral: request.title)
    let snoozeSeconds = max(0, request.snoozeMinutes) * 60

    let presentation: AlarmPresentation
    var countdown: Alarm.CountdownDuration? = nil
    if snoozeSeconds > 0 {
      let snoozeButton = AlarmButton(
        text: LocalizedStringResource(stringLiteral: "Snooze"),
        textColor: .white,
        systemImageName: "zzz")
      let alert = AlarmPresentation.Alert(
        title: title,
        stopButton: stopButton,
        secondaryButton: snoozeButton,
        secondaryButtonBehavior: .countdown)
      let snoozing = AlarmPresentation.Countdown(
        title: LocalizedStringResource(stringLiteral: "Snoozing"),
        pauseButton: nil)
      presentation = AlarmPresentation(alert: alert, countdown: snoozing, paused: nil)
      // No countdown before the first ring; Snooze counts down this long, then rings again.
      countdown = Alarm.CountdownDuration(preAlert: nil, postAlert: snoozeSeconds)
    } else {
      presentation = AlarmPresentation(alert: AlarmPresentation.Alert(title: title, stopButton: stopButton))
    }

    let attributes = AlarmAttributes<DawnAlarmMetadata>(
      presentation: presentation,
      metadata: DawnAlarmMetadata(birdName: request.birdName),
      tintColor: Color(red: 0.79, green: 0.47, blue: 0.37))

    let sound: AlertConfiguration.AlertSound
    if let name = request.sound, !name.isEmpty {
      sound = .named(name)
    } else {
      sound = .default
    }

    let configuration = AlarmManager.AlarmConfiguration<DawnAlarmMetadata>(
      countdownDuration: countdown,
      schedule: .fixed(date),
      attributes: attributes,
      sound: sound)

    _ = try await AlarmManager.shared.schedule(id: uuid(for: request.id), configuration: configuration)
  }

  /// A stable UUID for a string id, so the same alarm always maps to the same AlarmKit id.
  static func uuid(for id: String) -> UUID {
    var bytes = Array(Insecure.MD5.hash(data: Data(id.utf8)))
    bytes[6] = (bytes[6] & 0x0F) | 0x30 // version 3 (name-based, MD5)
    bytes[8] = (bytes[8] & 0x3F) | 0x80 // RFC 4122 variant
    return UUID(uuid: (bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
                       bytes[8], bytes[9], bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]))
  }

  private static func stateName(_ state: AlarmManager.AuthorizationState) -> String {
    switch state {
    case .authorized: return "authorized"
    case .denied: return "denied"
    case .notDetermined: return "notDetermined"
    @unknown default: return "notDetermined"
    }
  }
}
