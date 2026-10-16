/**
 * Static promos for the events flyer. Edit titles, dates, and copy here.
 * Game watch parties from the admin calendar are merged in on /events.
 */
export interface StaticEvent {
  id: string;
  emoji: string;
  title: string;
  when: string;
  detail: string;
  highlight?: boolean;
}

export const staticUpcomingEvents: StaticEvent[] = [
  {
    id: "nfl-sundays",
    emoji: "🏈",
    title: "NFL Sundays",
    when: "Every Sunday · All Day",
    detail: "Every game on 50+ HD TVs — wings, gyros, and cold beer.",
    highlight: true,
  },
  {
    id: "monday-night",
    emoji: "📺",
    title: "Monday Night Football",
    when: "Every Monday Night",
    detail: "Prime-time kickoff with the best seats at the bar.",
  },
  {
    id: "college-saturday",
    emoji: "🎓",
    title: "College Football Saturdays",
    when: "Saturdays · Gameday",
    detail: "NCAA on every screen — bring your crew.",
  },
  {
    id: "halloween",
    emoji: "🎃",
    title: "Halloween at JTAPS",
    when: "Friday, October 31",
    detail: "Costumes welcome — drink specials and late-night bites.",
    highlight: true,
  },
  {
    id: "rewards",
    emoji: "⭐",
    title: "JTAPS Rewards",
    when: "Sign up anytime",
    detail: "Get alerts for games, specials, and loyalty perks. Company code 2786.",
  },
];
