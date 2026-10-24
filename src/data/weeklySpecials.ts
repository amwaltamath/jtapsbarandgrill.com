/**
 * Weekly deals & happy hour — update here to refresh the site.
 */
export type Weekday =
  | "Sunday"
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday";

export interface WeeklySpecial {
  day: Weekday;
  emoji: string;
  headline: string;
  offer: string;
  extra?: string;
  highlight?: boolean;
}

export const happyHour = {
  title: "Happy Hour",
  days: "Monday–Friday",
  hours: "12 PM – 7 PM",
  summary: "Monday–Friday · 12 PM – 7 PM",
  note: "Drink and appetizer deals all afternoon — see each day for featured specials.",
};

export const weeklySpecials: WeeklySpecial[] = [
  {
    day: "Monday",
    emoji: "🍗",
    headline: "Wing Night",
    offer: "90¢ wings",
  },
  {
    day: "Tuesday",
    emoji: "🎤",
    headline: "Boneless Tuesday",
    offer: "80¢ boneless wings",
    extra: "Karaoke Tuesday · 8:30 PM",
  },
  {
    day: "Wednesday",
    emoji: "🥙",
    headline: "Gyro Day",
    offer: "$7 gyros",
    extra: "Music Bingo · 7:30 PM · $30, $20 & $10 gift cards",
  },
  {
    day: "Thursday",
    emoji: "🍺",
    headline: "Draft Night",
    offer: "$3 short drafts",
  },
  {
    day: "Friday",
    emoji: "🍟",
    headline: "Appetizer Friday",
    offer: "$2 off appetizers",
    extra: "During happy hour",
  },
  {
    day: "Saturday",
    emoji: "🏈",
    headline: "College Football",
    offer: "$15 beer buckets",
    extra: "All day on game day",
  },
  {
    day: "Sunday",
    emoji: "🐅",
    headline: "Who Dey Day",
    offer: "NFL games · $15 beer buckets",
    highlight: true,
  },
];

export function getCurrentWeekdayET(): Weekday {
  const day = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "America/New_York",
  });
  return day as Weekday;
}

export function isHappyHourDayET(day: Weekday = getCurrentWeekdayET()): boolean {
  return day !== "Saturday" && day !== "Sunday";
}
