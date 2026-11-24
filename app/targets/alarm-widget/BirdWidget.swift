// Dawn Chorus bird widget for the Lock Screen (and a small Home Screen size).
//
// Today's bird only appears once that morning's alarm has gone off ("Woke you up"). On a day
// with no alarm it appears once you've opened the app that day. From sunset it switches to a
// clue about tomorrow's bird, which stays hidden until tomorrow's alarm.
//
// The app writes the data as JSON into the shared App Group (app/src/state/widget-sync.ts):
// today and the next 7 days, each with the bird's id and name, the evening clue, sunset and
// the first alarm, plus the date the app was last opened. Bird photos are bundled into the
// widget as image assets named by bird id (targets/alarm-widget/birds).

import SwiftUI
import UIKit
import WidgetKit

private let appGroup = "group.io.github.dawnchorus.app"

struct WidgetData: Decodable {
  struct Day: Decodable {
    let day: String     // "YYYY-MM-DD", local time
    let id: String
    let name: String
    let clue: String
    let sunset: Double  // epoch seconds
    let alarm: Double   // first alarm that day, epoch seconds; 0 = none

    // Tolerant decoding: a field missing from an older app version shouldn't blank the widget.
    init(from decoder: Decoder) throws {
      let c = try decoder.container(keyedBy: CodingKeys.self)
      day = try c.decode(String.self, forKey: .day)
      id = try c.decodeIfPresent(String.self, forKey: .id) ?? ""
      name = try c.decodeIfPresent(String.self, forKey: .name) ?? "Dawn Chorus"
      clue = try c.decodeIfPresent(String.self, forKey: .clue) ?? ""
      sunset = try c.decodeIfPresent(Double.self, forKey: .sunset) ?? 0
      alarm = try c.decodeIfPresent(Double.self, forKey: .alarm) ?? 0
    }

    init(day: String, id: String, name: String, clue: String, sunset: Double, alarm: Double) {
      self.day = day; self.id = id; self.name = name; self.clue = clue; self.sunset = sunset; self.alarm = alarm
    }

    enum CodingKeys: String, CodingKey { case day, id, name, clue, sunset, alarm }
  }

  let opened: String
  let days: [Day]

  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    opened = try c.decodeIfPresent(String.self, forKey: .opened) ?? ""
    days = try c.decodeIfPresent([Day].self, forKey: .days) ?? []
  }

  init(opened: String, days: [Day]) {
    self.opened = opened; self.days = days
  }

  enum CodingKeys: String, CodingKey { case opened, days }

  static func load() -> WidgetData? {
    guard let json = UserDefaults(suiteName: appGroup)?.string(forKey: "widget"),
          let data = json.data(using: .utf8),
          let decoded = try? JSONDecoder().decode(WidgetData.self, from: data),
          !decoded.days.isEmpty else { return nil }
    return decoded
  }

  static var sample: WidgetData {
    let now = Date()
    return WidgetData(opened: dayKey(now), days: [
      Day(day: dayKey(now), id: "wood-thrush", name: "Wood Thrush", clue: "Bold, round black spots on a white breast",
          sunset: now.addingTimeInterval(6 * 3600).timeIntervalSince1970, alarm: now.addingTimeInterval(-3600).timeIntervalSince1970),
    ])
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

  enum Mode {
    case bird(Day, wokeYou: Bool)
    case mystery(Day, tomorrow: Bool)
  }

  /// What to show at a moment.
  func mode(at date: Date) -> Mode? {
    guard let today = day(for: date) else { return nil }
    let tomorrowDate = Calendar.current.date(byAdding: .day, value: 1, to: date) ?? date
    if today.sunset > 0, date >= Date(timeIntervalSince1970: today.sunset), let tomorrow = day(for: tomorrowDate) {
      return .mystery(tomorrow, tomorrow: true)
    }
    if today.alarm > 0 {
      // Revealed only once the alarm has gone off.
      return date >= Date(timeIntervalSince1970: today.alarm) ? .bird(today, wokeYou: true) : .mystery(today, tomorrow: false)
    }
    // No alarm today: revealed once you've opened the app today.
    return opened == today.day ? .bird(today, wokeYou: false) : .mystery(today, tomorrow: false)
  }

  /// Moments the widget should redraw: each alarm, each sunset and each midnight this week.
  func changeTimes(from now: Date) -> [Date] {
    var times: [Date] = []
    for d in days {
      if d.sunset > 0 { times.append(Date(timeIntervalSince1970: d.sunset)) }
      if d.alarm > 0 { times.append(Date(timeIntervalSince1970: d.alarm)) }
    }
    var midnight = Calendar.current.startOfDay(for: now)
    for _ in 0..<8 {
      guard let next = Calendar.current.date(byAdding: .day, value: 1, to: midnight) else { break }
      midnight = next
      times.append(next)
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
    let now = Date()
    guard let data = WidgetData.load() else {
      // Nothing from the app yet: show the placeholder and look again in an hour.
      completion(Timeline(entries: [BirdEntry(date: now, data: nil)], policy: .after(now.addingTimeInterval(3600))))
      return
    }
    let times = ([now] + data.changeTimes(from: now)).sorted().prefix(60)
    completion(Timeline(entries: times.map { BirdEntry(date: $0, data: data) }, policy: .atEnd))
  }
}

struct BirdWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "BirdWidget", provider: BirdProvider()) { entry in
      BirdWidgetView(entry: entry)
    }
    .configurationDisplayName("Dawn Chorus")
    .description("The bird that woke you, and a clue to tomorrow's after sunset.")
    .supportedFamilies([.accessoryRectangular, .accessoryCircular, .accessoryInline, .systemSmall])
  }
}

private let night = Color(red: 0.043, green: 0.063, blue: 0.149)
private let cream = Color(red: 0.97, green: 0.93, blue: 0.86)

/// The bird's bundled photo, if there is one.
private func photo(_ id: String) -> Image? {
  guard !id.isEmpty, let ui = UIImage(named: id) else { return nil }
  return Image(uiImage: ui)
}

struct BirdWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: BirdEntry

  private var mode: WidgetData.Mode? { entry.data?.mode(at: entry.date) }

  var body: some View {
    Group {
      switch family {
      case .accessoryInline: inline.containerBackground(.clear, for: .widget)
      case .accessoryCircular: circular.containerBackground(.clear, for: .widget)
      case .accessoryRectangular: rectangular.containerBackground(.clear, for: .widget)
      default: small
      }
    }
    .widgetURL(URL(string: "dawnchorus://"))
  }

  // MARK: Lock Screen

  @ViewBuilder private var inline: some View {
    switch mode {
    case .bird(let day, let wokeYou):
      Label(wokeYou ? "\(day.name) woke you up" : day.name, systemImage: "bird.fill")
    case .mystery(let day, let tomorrow):
      Label("\(tomorrow ? "Tomorrow" : "Today"): \(day.clue)", systemImage: "moon.stars.fill")
    case nil:
      Label("Dawn Chorus", systemImage: "bird.fill")
    }
  }

  @ViewBuilder private var circular: some View {
    switch mode {
    case .bird(let day, _):
      if let image = photo(day.id) {
        image.resizable().scaledToFill().clipShape(Circle())
      } else {
        ZStack { AccessoryWidgetBackground(); Image(systemName: "bird.fill").font(.system(size: 20)) }
      }
    default:
      ZStack {
        AccessoryWidgetBackground()
        Text("?").font(.system(size: 24, weight: .semibold, design: .serif))
      }
    }
  }

  @ViewBuilder private var rectangular: some View {
    HStack(spacing: 8) {
      switch mode {
      case .bird(let day, let wokeYou):
        tile(photo(day.id))
        VStack(alignment: .leading, spacing: 1) {
          Text(day.name)
            .font(.system(size: 16, weight: .semibold, design: .serif))
            .lineLimit(1)
            .minimumScaleFactor(0.7)
          Text(wokeYou ? "woke you up" : "today's bird")
            .font(.system(size: 12))
            .widgetAccentable()
        }
      case .mystery(let day, let tomorrow):
        tile(nil)
        Text("\(Text(tomorrow ? "Tomorrow: " : "Today: ").bold())\(day.clue)")
          .font(.system(size: 13))
          .lineLimit(3)
          .minimumScaleFactor(0.8)
      case nil:
        tile(nil)
        Text("Open Dawn Chorus").font(.system(size: 13))
      }
      Spacer(minLength: 0)
    }
  }

  /// A small rounded square: the bird's photo, or a "?" while it's still a mystery.
  @ViewBuilder private func tile(_ image: Image?) -> some View {
    if let image {
      image.resizable().scaledToFill().frame(width: 44, height: 44).clipShape(RoundedRectangle(cornerRadius: 9))
    } else {
      ZStack {
        RoundedRectangle(cornerRadius: 9).fill(.white.opacity(0.18))
        Text("?").font(.system(size: 22, weight: .semibold, design: .serif))
      }
      .frame(width: 44, height: 44)
    }
  }

  // MARK: Home Screen (small)

  private var small: some View {
    let isBird: Bool = { if case .bird = mode { return true }; return false }()
    let id: String = {
      switch mode {
      case .bird(let day, _), .mystery(let day, _): return day.id
      case nil: return ""
      }
    }()
    return VStack(alignment: .leading, spacing: 2) {
      Spacer()
      switch mode {
      case .bird(let day, let wokeYou):
        Text(day.name)
          .font(.system(size: 19, design: .serif))
          .foregroundStyle(cream)
          .lineLimit(2)
          .minimumScaleFactor(0.7)
        Text(wokeYou ? "woke you up" : "today's bird")
          .font(.system(size: 12))
          .foregroundStyle(cream.opacity(0.75))
      case .mystery(let day, let tomorrow):
        Text(tomorrow ? "Tomorrow" : "Today")
          .font(.system(size: 19, design: .serif))
          .foregroundStyle(cream)
        Text(day.clue)
          .font(.system(size: 12))
          .foregroundStyle(cream.opacity(0.8))
          .lineLimit(3)
          .minimumScaleFactor(0.8)
      case nil:
        Text("Dawn Chorus").font(.system(size: 19, design: .serif)).foregroundStyle(cream)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .containerBackground(for: .widget) {
      ZStack {
        night
        if let image = photo(id) {
          // The bird in full once it's woken you; a dark blur while it's still a mystery.
          image.resizable().scaledToFill()
            .blur(radius: isBird ? 0 : 18)
            .opacity(isBird ? 1 : 0.55)
        }
        LinearGradient(colors: [.clear, night.opacity(isBird ? 0.85 : 0.6)], startPoint: .center, endPoint: .bottom)
      }
    }
  }
}
