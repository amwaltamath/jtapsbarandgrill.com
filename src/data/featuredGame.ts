/**
 * One-off watch party. The banner hides itself after `hideAfter`.
 */
export const featuredGame = {
  matchup: "Bengals vs. Falcons",
  when: "Sunday, November 8",
  kickoff: "9:30 AM",
  location: "Madrid, Spain",
  doors: "9 AM",
  offer: "Mimosas, Bloody Marys, and a brunch menu",
  brunchDrinks: [
    {
      name: "Mimosas",
      emoji: "🥂",
      detail: "Classic brunch mimosas — available from doors open at 9 AM.",
    },
    {
      name: "Bloody Marys",
      emoji: "🍅",
      detail: "JTAPS Bloody Marys — available from doors open at 9 AM.",
    },
  ],
  brunchPath: "/bengals-brunch",
  brunchMenuImage: "/images/jtaps-brunch-menu.jpg",
  /** Bump when replacing the JPG so browsers fetch the new file. */
  brunchMenuImageVersion: 2,
  /** Midnight Monday ET, after the Sunday watch party. */
  hideAfter: "2026-11-09T05:00:00.000Z",
};

export function isFeaturedGameActive(now = new Date()) {
  return now.getTime() < new Date(featuredGame.hideAfter).getTime();
}
