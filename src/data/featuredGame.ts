/**
 * One-off watch party / game day promo. Banner hides after `hideAfter`.
 */
export type FeaturedGameKind = "brunch" | "mnf" | "hs-final";

export const featuredGame = {
  kind: "hs-final" as FeaturedGameKind,
  kicker: "OHSAA Division I · Region 4 Final",
  matchup: "Elder Panthers vs. Princeton Vikings",
  when: "Friday, November 20",
  kickoff: "7:00 PM",
  location: "Paycor Stadium",
  doors: "11 AM",
  offer:
    "Can't be at Paycor? Catch every snap on 50+ HD TVs — Appetizer Friday ($2 off apps) and happy hour until 7 PM.",
  highlightLine: "🏈 Regional Final · 🍟 Appetizer Friday",
  promoWeekday: "Friday" as const,
  primaryCta: {
    label: "Regional final tonight",
    href: "/elder-princeton-regional-final",
  },
  dedicationPath: "/elder-princeton-regional-final",
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
  hideAfter: "2026-11-21T05:00:00.000Z",
};

/** Swap into `featuredGame` after the regional final promo ends (Mon MNF). */
export const featuredGameMnfNov24 = {
  kind: "mnf" as FeaturedGameKind,
  kicker: "Monday Night Football",
  matchup: "Bengals vs. Commanders",
  when: "Monday, November 24",
  kickoff: "8:20 PM",
  location: undefined as string | undefined,
  doors: "11 AM",
  offer: "Who Dey on 50+ HD TVs — 90¢ wing night and happy hour until 7 PM.",
  highlightLine: "🏈 Monday Night Football · 🍗 90¢ wings",
  promoWeekday: "Monday" as const,
  primaryCta: {
    label: "Monday specials",
    href: "/specials",
  },
  dedicationPath: undefined as string | undefined,
  brunchDrinks: featuredGame.brunchDrinks,
  brunchPath: "/bengals-brunch",
  brunchMenuImage: "/images/jtaps-brunch-menu.jpg",
  brunchMenuImageVersion: 2,
  hideAfter: "2026-11-25T05:00:00.000Z",
};

export function isFeaturedGameActive(now = new Date()) {
  return now.getTime() < new Date(featuredGame.hideAfter).getTime();
}

export function isFeaturedBrunchActive(now = new Date()) {
  return featuredGame.kind === "brunch" && isFeaturedGameActive(now);
}

export function isFeaturedHsFinalActive(now = new Date()) {
  return featuredGame.kind === "hs-final" && isFeaturedGameActive(now);
}