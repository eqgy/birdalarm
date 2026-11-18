// Dawn Chorus Live Activity: what you see on the Lock Screen and in the Dynamic Island
// while an alarm is ringing or snoozed.
//
// - Ringing: "Good morning", and a hint to open the app to see who's singing. (iOS also shows
//   its own full alarm alert with the Stop and Snooze buttons.)
// - Snoozed: the bird's name, a big countdown to the next ring, and a Stop button.

import ActivityKit
import AlarmKit
import AppIntents
import SwiftUI
import WidgetKit

/// Must match the struct of the same name in modules/dawn-alarm/ios/DawnAlarmModule.swift.
struct DawnAlarmMetadata: AlarmMetadata {
  var birdName: String = ""
}

private let night = Color(red: 0.043, green: 0.063, blue: 0.149)
private let ember = Color(red: 0.79, green: 0.47, blue: 0.37)
private let cream = Color(red: 0.97, green: 0.93, blue: 0.86)

@main
struct DawnChorusWidgets: WidgetBundle {
  var body: some Widget {
    AlarmLiveActivity()
  }
}

struct AlarmLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: AlarmAttributes<DawnAlarmMetadata>.self) { context in
      LockScreenView(state: context.state, birdName: context.attributes.metadata?.birdName ?? "")
        .activityBackgroundTint(night)
        .activitySystemActionForegroundColor(cream)
    } dynamicIsland: { context in
      let bird = context.attributes.metadata?.birdName ?? ""
      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          BirdBadge(size: 44)
        }
        DynamicIslandExpandedRegion(.trailing) {
          CountdownText(state: context.state)
            .font(.system(size: 32, weight: .light, design: .serif))
            .foregroundStyle(cream)
        }
        DynamicIslandExpandedRegion(.bottom) {
          HStack {
            Headline(state: context.state, birdName: bird)
            Spacer()
            StopButton(state: context.state)
          }
        }
      } compactLeading: {
        Image(systemName: "bird.fill").foregroundStyle(ember)
      } compactTrailing: {
        CountdownText(state: context.state)
          .font(.system(size: 14, weight: .medium).monospacedDigit())
          .foregroundStyle(cream)
          .frame(maxWidth: 52)
      } minimal: {
        Image(systemName: "bird.fill").foregroundStyle(ember)
      }
      .keylineTint(ember)
    }
  }
}

private struct LockScreenView: View {
  let state: AlarmPresentationState
  let birdName: String

  var body: some View {
    HStack(spacing: 14) {
      BirdBadge(size: 52)
      VStack(alignment: .leading, spacing: 4) {
        Headline(state: state, birdName: birdName)
        CountdownText(state: state)
          .font(.system(size: 34, weight: .light, design: .serif))
          .foregroundStyle(cream)
      }
      Spacer(minLength: 8)
      StopButton(state: state)
    }
    .padding(18)
  }
}

/// A warm sunrise disc with a bird in it.
private struct BirdBadge: View {
  let size: CGFloat
  var body: some View {
    ZStack {
      Circle().fill(LinearGradient(colors: [ember, Color(red: 0.98, green: 0.78, blue: 0.55)],
                                   startPoint: .bottom, endPoint: .top))
      Image(systemName: "bird.fill")
        .font(.system(size: size * 0.45))
        .foregroundStyle(night)
    }
    .frame(width: size, height: size)
  }
}

private struct Headline: View {
  let state: AlarmPresentationState
  let birdName: String

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      switch state.mode {
      case .countdown:
        Text("SNOOZING")
          .font(.system(size: 11, weight: .semibold)).tracking(1.4)
          .foregroundStyle(ember)
        Text(birdName.isEmpty ? "Your bird sings again in" : "The \(birdName) sings again in")
          .font(.system(size: 14, design: .serif)).italic()
          .foregroundStyle(cream.opacity(0.85))
      case .paused:
        Text("PAUSED")
          .font(.system(size: 11, weight: .semibold)).tracking(1.4)
          .foregroundStyle(ember)
      default:
        Text("GOOD MORNING")
          .font(.system(size: 11, weight: .semibold)).tracking(1.4)
          .foregroundStyle(ember)
        Text("Open Dawn Chorus to see who's singing")
          .font(.system(size: 14, design: .serif)).italic()
          .foregroundStyle(cream.opacity(0.85))
      }
    }
  }
}

/// Counts down to the next ring while snoozed; otherwise shows the time now.
private struct CountdownText: View {
  let state: AlarmPresentationState

  var body: some View {
    switch state.mode {
    case .countdown(let countdown):
      // A range whose end is in the past would crash, so never let it end before now.
      Text(timerInterval: Date.now...max(countdown.fireDate, Date.now), countsDown: true)
        .monospacedDigit()
        .multilineTextAlignment(.leading)
    default:
      Text(Date.now, style: .time)
    }
  }
}

private struct StopButton: View {
  let state: AlarmPresentationState

  var body: some View {
    if case .countdown = state.mode {
      Button(intent: StopAlarmIntent(alarmID: state.alarmID.uuidString)) {
        Image(systemName: "xmark")
          .font(.system(size: 16, weight: .semibold))
          .foregroundStyle(night)
          .frame(width: 40, height: 40)
          .background(Circle().fill(cream))
      }
      .buttonStyle(.plain)
      .accessibilityLabel("Stop alarm")
    }
  }
}
