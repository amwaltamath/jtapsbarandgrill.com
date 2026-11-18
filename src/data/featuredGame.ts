/**
 * One-off watch party / game day promo. Banner hides after `hideAfter`.
 */
export type FeaturedGameKind = "brunch" | "mnf";

export const featuredGame = {
  kind: "mnf" as FeaturedGameKind,
  kicker: "Monday Night Football",
  matchup: "Bengals vs. Commanders",
  when: "Monday, November 24",
  kickoff: "8:20 PM",
  /** Shown after kickoff time when set (e.g. Madrid). Omitted for home MNF. */
  location: undefined as string | undefined,
  doors: "11 AM",
  offer: "Who Dey on 50+ HD TVs — 90¢ wing night and happy hour until 7 PM.",
  highlightLine: "🏈 Monday Night Football · 🍗 90¢ wings",
  promoWeekday: "Monday" as const,
  primaryCta: {
    label: "Monday specials",
    href: "/specials",
  },
  /** Brunch-only fields (kind: "brunch") */
  brunchDrinks: [
    {
      name: "Mimosas",
      emoji: "🥂",
      detail: "Classic brunch mimosas — available from doors open.",
    },
    {
      name: "Bloody Marys",
      emoji: "🍅",
      detail: "JTAPS Bloody Marys — available from doors open.",
    },
  ],
  brunchPath: "/bengals-brunch",
  brunchMenuImage: "/images/jtaps-brunch-menu.jpg",
  brunchMenuImageVersion: 2,
  /** Midnight ET after the game day promo ends */
  hideAfter: "2026-11-25T05:00:00.000Z",
};

export function isFeaturedGameActive(now = new Date()) {
  return now.getTime() < new Date(featuredGame.hideAfter).getTime();
}

export function isFeaturedBrunchActive(now = new Date()) {
  return featuredGame.kind === "brunch" && isFeaturedGameActive(now);
}