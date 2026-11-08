# Roadmap after v1

The game is live and installed on Max's phone. This is the order of work from here, why that order, and
what each phase gates. Execution lives in the issues; this file holds the reasoning so a later session does
not have to reconstruct it.

Written 2026-11-08. Decisions marked **NEEDS MAX** block the phase they sit in.

## Phase 1 — make updates controllable, then fix the menu

**#6 Boot screen and controlled update flow** — do this first, before any visible change.

- Why first: `public/sw.js` currently forces a new version on the running app (`skipWaiting` + `clients.claim`)
  with no UI and no version number. Every change we ship from now on arrives invisibly and can interrupt a
  run. Until that flow is real, we cannot tell whether a fix reached the phone, and the load screen Max asked
  for is exactly that flow's front door. Fixing the menu first would mean shipping a broken update mechanism
  twice.
- Gates: no user-visible feature work merges until the version string and the update path exist.

**#5 Menu: one clear way into the night**

- Why second: it is the first thing every player sees and it currently hides the play button below the fold,
  clips a character card mid-sentence, and gives four secondary buttons the same weight as the primary action.
  Cheap to fix, high impact per hour.
- Depends on #6 for the version display in settings.

**Definition of done for phase 1:** Max updates the installed app from the URL, the version number changes,
a run in progress is never interrupted, and the menu starts a night without scrolling on a 375×667 screen.

## Phase 2 — make it legible and worth returning to

**#7 Lore: cold open and codex.** Draft copy sits in `LORE.md`. **NEEDS MAX:** approve or rewrite the copy
before anyone implements it. The story answers the two questions a new player asks, and does it with text so
it stays cheap to change and translate.

**#4 Tune nights 4+ and playtest with someone else.** Do this after the lore lands, because a first-time
player's confusion is partly a story problem, not a difficulty problem. Watch the first 20 seconds and the
revive offer.

**#3 Art pass.** Largest remaining quality lever, but the most expensive per hour. Sequence it after the
cheap wins above, and judge it at gameplay zoom.

## Phase 3 — App Store

Max wants it in the App Store. That is a different release channel with different rules, not a deploy.
Phases 1–2 are not wasted by it: every one of them ships to the store build too.

- **Wrapper, not a rewrite.** The game stays the same Vite build and gets a native shell so it can be
  signed, installed and updated through the store. The web build keeps working as it does today.
- **Two update lanes, and they are not equivalent.** JS and assets can keep updating through the service
  worker flow from #6. Anything native (a new plugin, a permission, an SDK) needs a store submission and
  review. This is why #6 is the foundation of the whole roadmap.
- **Commerce changes hands.** Apple requires its own in-app purchase for digital goods sold inside the app,
  which is what the `IapProvider` mock in `src/monetize/ads.ts` exists to absorb (#2). Budget for a store
  commission on every purchase, and check whether rewarded ads need a tracking prompt.
- **Review risk is real.** A wrapped website can be rejected for being "just a website". Native-only
  affordances — haptics, backgrounding behaviour, a real offline story — are what make it read as an app
  rather than a bookmark.
- **Cost and timeline figures** are being verified against Apple's own pages rather than quoted from memory;
  they land in the App Store issue with sources.

**NEEDS MAX before this phase starts:** an Apple Developer account decision (cost, and whether the game is
worth the annual fee), and a decision on whether to ship free-with-ads first or with purchases from day one.

## Not on this roadmap

- New gameplay systems. The sim is frozen and balanced on a knife edge; nothing here touches `src/sim/`.
- Marketing/launch video. See `LORE.md` — a rendered video is for the store page and the launch post, not
  for inside the app.