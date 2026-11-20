// Dawn Chorus bird widget for the Lock Screen (and a small Home Screen size).
//
// Through the day it shows the bird that woke you (everyone gets the same bird on the same
// date). Around sunset it turns mysterious: a teaser line for tomorrow's bird and a small hint,
// until the next morning's alarm reveals it. The teaser changes every day.
//
// The app writes the data as JSON into the shared App Group (app/src/state/widget-sync.ts):
// today and the next 7 days, each with its bird, teaser, hint, sunset and first alarm. So the
// widget switches at the right moments without the app running.

import SwiftUI
import WidgetKit

private let appGroup = "group.io.github.dawnchorus.app"

struct WidgetData: Decodable {
  struct Day: Decodable {
    let day: String     // "YYYY-MM-DD", local time
    let name: String
    let sci: String
    let teaser: String
    let hint: String
    let sunset: Double  // epoch seconds
    let alarm: Double   // first alarm that day, epoch seconds; 0 = none
  }
  let days: [Day]
  let alarms: [Double]  // upcoming alarms, epoch seconds

  static func load() -> WidgetData? {
    guard let json = UserDefaults(suiteName: appGroup)?.string(forKey: "widget"),
          let data = json.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(WidgetData.self, from: data)
  }

  static var sample: WidgetData {
    let now = Date()
    return WidgetData(
      days: [Day(day: dayKey(now), name: "Wood Thrush", sci: "Hylocichla mustelina",
                 teaser: "Tomorrow's singer is practicing in the dark.", hint: "Hint: from the thrushes family",
                 sunset: now.addingTimeInterval(6 * 3600).timeIntervalSince1970, alarm: 0)],
      alarms: [now.addingTimeInterval(14 * 3600).timeIntervalSince1970])
  }

  static func dayKey(_ date: Date) -> String {
    let f = DateFormatter()
    f.calendar = Calendar(identifier: .gregorian)
    f.locale = Locale(identifier: "en_US_POSIX")
    f.timeZone = .current
    f.dateFormat = "yyyy-MM-dd"
    return f.string(from: date)
  }

  func day(for date: Date) -> Day? {
    let key = Self.dayKey(date)
    return days.first { $0.day == key }
  }

  func nextAlarm(after date: Date) -> Date? {
    alarms.map { Date(timeIntervalSince1970: $0) }.filter { $0 > date }.min()
  }

  /// When today's bird is revealed: the first alarm that day, or 6 am if there's none.
  func reveal(for day: Day, on date: Date) -> Date {
    if day.alarm > 0 { return Date(timeIntervalSince1970: day.alarm) }
    return Calendar.current.date(bySettingHour: 6, minute: 0, second: 0, of: date) ?? date
  }

  enum Mode {
    case bird(Day, wokeYou: Bool)
    case mystery(Day)  // the day being teased
  }

  /// What to show at a moment.
  func mode(at date: Date) -> Mode? {
    guard let today = day(for: date) else { return nil }
    if date < reveal(for: today, on: date) { return .mystery(today) }  // night before the alarm
    if date >= Date(timeIntervalSince1970: today.sunset),
       let tomorrow = day(for: Calendar.current.date(byAdding: .day, value: 1, to: date) ?? date) {
      return .mystery(tomorrow)
    }
    return .bird(today, wokeYou: today.alarm > 0)
  }

  /// Moments the widget should redraw: midnights, reveals and sunsets for the coming week.
  func changeTimes(from now: Date) -> [Date] {
    var times: [Date] = []
    let calendar = Calendar.current
    for d in days {
      times.append(Date(timeIntervalSince1970: d.sunset))
      if d.alarm > 0 { times.append(Date(timeIntervalSince1970: d.alarm + 30)) }
    }
    var midnight = calendar.startOfDay(for: now)
    for _ in 0..<8 {
      if let next = calendar.date(byAdding: .day, value: 1, to: midnight) {
        midnight = next
        times.append(next)
        if let six = calendar.date(bySettingHour: 6, minute: 0, second: 0, of: next) { times.append(six) }
      }
    }
    return times.filter { $0 > now && $0 < now.addingTimeInterval(8 * 86400) }
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
    let times = ([now] + (data?.changeTimes(from: now) ?? [])).sorted().prefix(60)
    completion(Timeline(entries: times.map { BirdEntry(date: $0, data: data) }, policy: .atEnd))
  }
}

struct BirdWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "BirdWidget", provider: BirdProvider()) { entry in
      BirdWidgetView(entry: entry)
    }
    .configurationDisplayName("Dawn Chorus")
    .description("The bird that woke you, then a mystery for tomorrow after sunset.")
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

  private var mode: WidgetData.Mode? { entry.data?.mode(at: entry.date) }
  private var alarm: Date? { entry.data?.nextAlarm(after: entry.date) }

  var body: some View {
    content.widgetURL(URL(string: "dawnchorus://"))
  }

  @ViewBuilder private var content: some View {
    switch family {
    case .accessoryInline: inline.containerBackground(.clear, for: .widget)
    case .accessoryCircular: circular.containerBackground(.clear, for: .widget)
    case .accessoryRectangular: rectangular.containerBackground(.clear, for: .widget)
    default:
      small.containerBackground(for: .widget) {
        LinearGradient(colors: isMystery ? [night, night, dusk] : [night, dusk, ember.opacity(0.85)],
                       startPoint: .top, endPoint: .bottom)
      }
    }
  }

  private var isMystery: Bool {
    if case .mystery = mode { return true }
    return false
  }

  // One line above the clock.
  @ViewBuilder private var inline: some View {
    switch mode {
    case .mystery:
      if let alarm {
        Label { Text("Mystery bird · ") + Text(alarm, style: .time) } icon: { Image(systemName: "moon.stars.fill") }
      } else {
        Label("A mystery bird awaits", systemImage: "moon.stars.fill")
      }
    case .bird(let day, _):
      Label(day.name, systemImage: "bird.fill")
    case nil:
      Label("Dawn Chorus", systemImage: "bird.fill")
    }
  }

  @ViewBuilder private var circular: some View {
    ZStack {
      AccessoryWidgetBackground()
      VStack(spacing: 1) {
        if isMystery {
          Text("?").font(.system(size: 20, weight: .semibold, design: .serif))
        } else {
          Image(systemName: "bird.fill").font(.system(size: 15, weight: .semibold))
        }
        if let alarm, isMystery {
          Text(alarm, style: .time)
            .font(.system(size: 10, weight: .semibold).monospacedDigit())
            .minimumScaleFactor(0.6)
            .lineLimit(1)
        }
      }
      .padding(4)
    }
  }

  @ViewBuilder private var rectangular: some View {
    switch mode {
    case .mystery(let day):
      VStack(alignment: .leading, spacing: 1) {
        HStack(spacing: 4) {
          Image(systemName: "moon.stars.fill").font(.system(size: 10))
          Text("TOMORROW'S BIRD").font(.system(size: 10, weight: .semibold))
        }
        .widgetAccentable()
        Text(day.teaser)
          .font(.system(size: 13, design: .serif)).italic()
          .lineLimit(2)
          .minimumScaleFactor(0.8)
        Text(day.hint).font(.system(size: 11)).lineLimit(1).minimumScaleFactor(0.8)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    case .bird(let day, let wokeYou):
      HStack(spacing: 8) {
        Image(systemName: "bird.fill").font(.system(size: 22, weight: .semibold)).widgetAccentable()
        VStack(alignment: .leading, spacing: 1) {
          Text(wokeYou ? "WOKE YOU UP" : "TODAY'S BIRD").font(.system(size: 10, weight: .semibold)).widgetAccentable()
          Text(day.name)
            .font(.system(size: 15, weight: .semibold, design: .serif))
            .lineLimit(1)
            .minimumScaleFactor(0.75)
          Text(day.sci).font(.system(size: 11, design: .serif)).italic().lineLimit(1)
        }
        Spacer(minLength: 0)
      }
    case nil:
      HStack(spacing: 8) {
        Image(systemName: "bird.fill").font(.system(size: 22, weight: .semibold))
        Text("Open Dawn Chorus to set up").font(.system(size: 13))
      }
    }
  }

  // Home Screen, small.
  @ViewBuilder private var small: some View {
    VStack(alignment: .leading, spacing: 4) {
      HStack {
        Image(systemName: isMystery ? "moon.stars.fill" : "bird.fill").foregroundStyle(ember)
        Spacer()
        if let alarm {
          Text(alarm, style: .time)
            .font(.system(size: 13, weight: .medium).monospacedDigit())
            .foregroundStyle(cream.opacity(0.8))
        }
      }
      Spacer()
      switch mode {
      case .mystery(let day):
        Text("TOMORROW'S BIRD").font(.system(size: 10, weight: .semibold)).tracking(1.2).foregroundStyle(ember)
        Text(day.teaser)
          .font(.system(size: 15, design: .serif)).italic()
          .foregroundStyle(cream)
          .lineLimit(3)
          .minimumScaleFactor(0.75)
        Text(day.hint).font(.system(size: 10)).foregroundStyle(cream.opacity(0.65)).lineLimit(2)
      case .bird(let day, let wokeYou):
        Text(wokeYou ? "WOKE YOU UP" : "TODAY'S BIRD").font(.system(size: 10, weight: .semibold)).tracking(1.2).foregroundStyle(ember)
        Text(day.name)
          .font(.system(size: 20, design: .serif))
          .foregroundStyle(cream)
          .lineLimit(2)
          .minimumScaleFactor(0.7)
        Text(day.sci).font(.system(size: 11, design: .serif)).italic().foregroundStyle(cream.opacity(0.7)).lineLimit(1)
      case nil:
        Text("Dawn Chorus").font(.system(size: 20, design: .serif)).foregroundStyle(cream)
      }
    }
  }
}
