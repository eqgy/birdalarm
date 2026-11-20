// Dawn Chorus bird widget for the Lock Screen (and a small Home Screen size): today's bird and
// your next alarm. The app writes the data as JSON into the shared App Group
// (app/src/state/widget-sync.ts): the bird for today and the next 7 days, and upcoming alarm
// times, so the widget stays right at midnight and after each alarm without the app running.

import SwiftUI
import WidgetKit

private let appGroup = "group.io.github.dawnchorus.app"

struct WidgetData: Decodable {
  struct Day: Decodable {
    let day: String   // "YYYY-MM-DD", local time
    let name: String
    let sci: String
    let woke: Int     // 1 if this bird already woke you today
  }
  let days: [Day]
  let alarms: [Double]  // epoch seconds

  static func load() -> WidgetData? {
    guard let json = UserDefaults(suiteName: appGroup)?.string(forKey: "widget"),
          let data = json.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(WidgetData.self, from: data)
  }

  static let sample = WidgetData(
    days: [Day(day: "", name: "Wood Thrush", sci: "Hylocichla mustelina", woke: 0)],
    alarms: [Date().addingTimeInterval(8 * 3600).timeIntervalSince1970])

  func bird(on date: Date) -> Day? {
    let f = DateFormatter()
    f.calendar = Calendar(identifier: .gregorian)
    f.locale = Locale(identifier: "en_US_POSIX")
    f.timeZone = .current
    f.dateFormat = "yyyy-MM-dd"
    let key = f.string(from: date)
    return days.first { $0.day == key } ?? (days.first?.day == "" ? days.first : nil)
  }

  func nextAlarm(after date: Date) -> Date? {
    alarms.map { Date(timeIntervalSince1970: $0) }.filter { $0 > date }.min()
  }
}

struct BirdEntry: TimelineEntry {
  let date: Date
  let data: WidgetData?
}

struct BirdProvider: TimelineProvider {
  func placeholder(in context: Context) -> BirdEntry {
    BirdEntry(date: .now, data: .sample)
  }

  func getSnapshot(in context: Context, completion: @escaping (BirdEntry) -> Void) {
    completion(BirdEntry(date: .now, data: WidgetData.load() ?? .sample))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<BirdEntry>) -> Void) {
    let data = WidgetData.load()
    let now = Date()
    let calendar = Calendar.current
    // Refresh at each local midnight (new bird) and just after each alarm (next alarm time).
    var dates: Set<Date> = [now]
    var midnight = calendar.startOfDay(for: now)
    for _ in 0..<7 {
      if let next = calendar.date(byAdding: .day, value: 1, to: midnight) {
        midnight = next
        dates.insert(next)
      }
    }
    for alarm in data?.alarms ?? [] {
      let d = Date(timeIntervalSince1970: alarm).addingTimeInterval(60)
      if d > now && d < now.addingTimeInterval(7 * 86400) { dates.insert(d) }
    }
    let entries = dates.sorted().prefix(40).map { BirdEntry(date: $0, data: data) }
    completion(Timeline(entries: Array(entries), policy: .atEnd))
  }
}

struct BirdWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "BirdWidget", provider: BirdProvider()) { entry in
      BirdWidgetView(entry: entry)
    }
    .configurationDisplayName("Today's Bird")
    .description("Today's bird and your next alarm.")
    .supportedFamilies([.accessoryRectangular, .accessoryCircular, .accessoryInline, .systemSmall])
  }
}

private let night = Color(red: 0.043, green: 0.063, blue: 0.149)
private let dusk = Color(red: 0.19, green: 0.16, blue: 0.36)
private let ember = Color(red: 0.79, green: 0.47, blue: 0.37)
private let cream = Color(red: 0.97, green: 0.93, blue: 0.86)

struct BirdWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: BirdEntry

  private var bird: WidgetData.Day? { entry.data?.bird(on: entry.date) }
  private var alarm: Date? { entry.data?.nextAlarm(after: entry.date) }
  private var label: String { bird?.woke == 1 ? "WOKE YOU UP" : "TODAY'S BIRD" }

  var body: some View {
    content
      .widgetURL(URL(string: "dawnchorus://"))
  }

  @ViewBuilder private var content: some View {
    switch family {
    case .accessoryInline:
      // One line above the clock.
      if let alarm {
        Label { Text("\(bird?.name ?? "Dawn Chorus") · ") + Text(alarm, style: .time) } icon: { Image(systemName: "bird.fill") }
          .containerBackground(.clear, for: .widget)
      } else {
        Label(bird?.name ?? "Dawn Chorus", systemImage: "bird.fill")
          .containerBackground(.clear, for: .widget)
      }

    case .accessoryCircular:
      ZStack {
        AccessoryWidgetBackground()
        VStack(spacing: 1) {
          Image(systemName: "bird.fill").font(.system(size: 15, weight: .semibold))
          if let alarm {
            Text(alarm, style: .time)
              .font(.system(size: 11, weight: .semibold).monospacedDigit())
              .minimumScaleFactor(0.6)
              .lineLimit(1)
          }
        }
        .padding(4)
      }
      .containerBackground(.clear, for: .widget)

    case .accessoryRectangular:
      HStack(alignment: .center, spacing: 8) {
        Image(systemName: "bird.fill")
          .font(.system(size: 22, weight: .semibold))
          .widgetAccentable()
        VStack(alignment: .leading, spacing: 1) {
          Text(label)
            .font(.system(size: 10, weight: .semibold))
            .widgetAccentable()
          Text(bird?.name ?? "Open Dawn Chorus")
            .font(.system(size: 15, weight: .semibold, design: .serif))
            .lineLimit(1)
            .minimumScaleFactor(0.75)
          if let alarm {
            (Text("Alarm ") + Text(alarm, style: .time))
              .font(.system(size: 12))
              .lineLimit(1)
          } else {
            Text("No alarm set").font(.system(size: 12))
          }
        }
        Spacer(minLength: 0)
      }
      .containerBackground(.clear, for: .widget)

    default:
      // Home Screen, small: a little dawn scene with the bird's name.
      VStack(alignment: .leading, spacing: 4) {
        HStack {
          Image(systemName: "bird.fill").foregroundStyle(ember)
          Spacer()
          if let alarm {
            Text(alarm, style: .time)
              .font(.system(size: 13, weight: .medium).monospacedDigit())
              .foregroundStyle(cream.opacity(0.8))
          }
        }
        Spacer()
        Text(label)
          .font(.system(size: 10, weight: .semibold)).tracking(1.2)
          .foregroundStyle(ember)
        Text(bird?.name ?? "Dawn Chorus")
          .font(.system(size: 20, weight: .regular, design: .serif))
          .foregroundStyle(cream)
          .lineLimit(2)
          .minimumScaleFactor(0.7)
        if let sci = bird?.sci {
          Text(sci)
            .font(.system(size: 11, design: .serif)).italic()
            .foregroundStyle(cream.opacity(0.7))
            .lineLimit(1)
        }
      }
      .containerBackground(for: .widget) {
        LinearGradient(colors: [night, dusk, ember.opacity(0.85)], startPoint: .top, endPoint: .bottom)
      }
    }
  }
}
