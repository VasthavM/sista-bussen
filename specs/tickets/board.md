# Board

Mirrors GitHub Issues in `VasthavM/sista-bussen`. The eval is the acceptance criteria in each issue's body and comments.
Integration branch for this wave: `totto/phase1` (off `main`).

| # | Ticket | status | mode | runs (after) | owner / branch |
|---|---|---|---|---|---|
| 6 | Boot screen and controlled update flow | in-progress | solo | — | worker `w6-update` on `fix/update-flow` (main checkout) |
| 9 | Onboarding ad gate (12 min playtime) | in-progress | solo | — | worker `w9-adgate` |
| 8 | App Store: Capacitor scaffold + update-lane spike (slice 1) | in-progress | solo | — | worker `w8-capacitor` (merge held until spike reviewed) |
| 5 | Menu + visible weapon/character picker | ready | solo | 6 | — |
| 1 | Point sista-bussen.vasthavm.com at the deployment | blocked | — | — | **Max**: DNS A record. Totto does the Coolify domain change after |
| 7 | Lore cold open + codex | blocked | solo | 5 | **Max**: approve `LORE.md` copy |
| 4 | Tune nights 4+, playtest with someone else | blocked | solo | 5, 7, analytics | **Max**: playtester; analytics destination undecided |
| 2 | Real ads (AdMob in the wrapper) | blocked | solo | 8, 9 | waits on the spike + Apple verification |
| 3 | Art pass | ready | solo | 4 | last |

## Conflict map (why only three run at once)

- #6 owns `index.html`, `public/sw.js`, `vite.config.ts`, `src/main.ts`, `src/updates.ts`, `src/version.ts`, `src/ui/settings.ts`, `src/style.css`.
- #9 owns `src/meta/save.ts`, `src/monetize/catalog.ts`, ad-offer sites in `src/ui/` (summary, levelup, crate, contracts). Touches `src/game.ts` for playtime only.
- #8 owns `package.json` deps, `capacitor.config.ts`, `ios/`, a haptics adapter.
- #5 rewrites `src/ui/menu.ts` + `style.css` + `main.ts` wiring, so it waits for #6.
