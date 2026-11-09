# #16 playable route loop: worker notes (w16-flow)

Branch `totto/16-flow`, worktree `/Users/vasthavm/Code/Worktrees-dsf/16-flow`. Based on `totto/v2` 04c16e7, then merged `totto/v2` 4e769a9 (#14, #15; save v4) in `4081fb3`.

## What changed
- `src/flow.ts` (new, pure, unit tested): `mapConfigFor` (uses #12's `fuelQuotaFor` as base quota; boss stop plays as `stop: 'horde'`), `stopInSegment`, `addMaterials`, `elapsedLabel`.
- `src/game.ts` (flow only): `startMap(choice)` replaces `startRun`; phases `route` added; the map result is settled into route + bank through `applyMapResult` **when the summary opens** (a killed iOS PWA keeps the haul and the fall-back); a revive restores the pre-settle route/bank; CONTINUE and "abandon map" go to the route screen; `meetQuota()` debug hook. Runs no longer pay Biljetter (Växel is gone); counters and contracts still update via `applyRunOutcome` with a zero payout.
- `src/main.ts`: START -> route screen; safe stops resolve on the route screen (`resolveSafeStop`, flash strip); debug `startRun()` skips the route screen (first non-safe stop); English toasts.
- `src/ui/route.ts` (new): route screen. `src/ui/icons.ts` (new): stroke icons, material chips, stop copy. `src/ui/flow.css` (new): all new styling, so `style.css` is untouched (some old rules are now dead).
- `src/ui/hud.ts`: fuel gauge panel (current / quota), elapsed timer m:ss, 3 material counters, persistent "All aboard: get to the bus" strip, DOM arrow to the bus when off screen. No Växel, no 03:00 clock. English throughout incl. the pause sheet.
- `src/ui/summary.ts`: extracted (fuel, gained materials, kills, time) / died (lost materials, "Back to stop N"), revive offer on death, **double materials** on extraction (same `double_fares` placement, cap and gate), CONTINUE.
- `src/ui/menu.ts`: night selector gone, loadout row stays, the Biljetter chip is three material chips, a "Your route" card (stop N / 10 line) fills the space. All menu copy is English, title ZOMBUS.
- `src/monetize/catalog.ts`: only revive and `double_fares` title/reward strings (ids unchanged).
- `src/render/index.ts`: removed the `drawGoalArrow` call (and import): #12's canvas arrow broke the one-DOM-HUD rule. The dead function is still in `render/objective.ts`.
- `src/debug.ts`: `meetQuota`, `profile().route`, `profile().routeSeed`.
- Tests: `tests/flow.test.ts` (7), `tests/e2e/route.spec.ts` (6), existing specs updated to the new flow.

## Design calls (check these)
- Route screen is a bus-line diagram (10 stops, checkpoint flag at the start, crown at the boss) over 2-4 full-width stop cards (icon tile, name, blurb, reward chip, 3 danger pips coloured green/amber/red). One tap plays the stop.
- "Stop N / 10" is segment-relative; "Depth" is absolute. Death text reads "Back to stop 1" plus "Checkpoint at depth 11".
- The double-materials offer only shows on extraction: a death loses the haul, so there is nothing to double.
- Boss stop is a lone card labelled "BOSS (coming soon)" and plays as a horde with the boss row's quota/density/material numbers.
- analytics.ts event shapes are unchanged (`night` carries the depth).

## AC results
- [x] Game flow: START -> route screen; stop -> `MapConfig` via `buildMapConfig` with `fuelQuotaFor`; `MapResult` through `applyMapResult`; extraction -> route one stop further; death -> revive offer (gated by #9, unchanged) then checkpoint; boss plays as horde with the label; safe stops resolve on the route screen. Evidence: `route.spec.ts` tests 1, 3, 4, 5, 6 pass (chromium).
- [x] Route screen: "Stop 1 / 10", depth, checkpoint flag, 2-4 cards with icon + name + pips + reward chip, material totals, no scrolling at 375x667 (asserted: every card inside the viewport, `.route__options` not scrollable). `screenshots/route-375x667.png`, `route-deep-375x667.png`, `route-safe-*.png`, `route-boss-375x667.png`.
- [x] Map HUD: fuel gauge, goal strip, material counter, elapsed timer. `screenshots/hud-375x667.png`. **Arrow:** the test passes (arrow on screen, inside the viewport), but I moved the arrow's top inset after the screenshot showed it touching the goal strip; that change is not browser-verified yet (see risks).
- [x] Summaries: extracted and died, both at 375x667 (`summary-extracted-375x667.png`, `summary-died-375x667.png`). Double materials banks exactly one more copy (asserted in `route.spec.ts` and `money.spec.ts`).
- [x] Menu: night picker gone, loadout row kept, materials chips (`menu.spec.ts` updated, passes).
- [x] E2E: `route.spec.ts` covers start -> route -> stop -> quota -> bus -> summary -> route at stop 2, death -> checkpoint (from depth 14, checkpoint 10 -> depth 11), safe stop, boss label, revive undoing the fall-back. money, adgate, menu, map, game specs pass on chromium (run 2, before the arrow-inset tweak): 27/27 for those files.
- [x] `npm test`: 16 files, 169 tests pass. `npm run build`: green.
- [ ] Full e2e: chromium update.spec had 4 failures from the old Swedish label `INSTÄLLNINGAR` in its settings helper; fixed in f33b2fc, **not re-run** (Totto stopped e2e for the audio issue). WebKit update.spec: same cause, not re-run.
- [ ] `npm run build:docker-check`: **blocked**, the Docker daemon is not running on this machine (`failed to connect to the docker API at unix:///Users/vasthavm/.docker/run/docker.sock`). Needs Docker started, then re-run.

## Open risks
- Needs one more e2e pass once Totto says go: `PW_PORT=4188 npx playwright test` (chromium + webkit), especially `route.spec.ts` for the arrow inset and `update.spec.ts` for the label fix. Then regenerate screenshots.
- Dead code left on purpose: `drawGoalArrow` in `render/objective.ts` (#17), old night/wallet/HUD CSS in `style.css`.
- Menu loadout names/descriptions are still Swedish: they come from `sim/content.ts` (#17). Shop, crate, contracts, settings, level-up, ad overlay and the update banner copy are also still Swedish (not my files). update.spec still matches the Swedish banner ("Ny version klar", /uppdatera/).
- Safe-stop flash strip auto-fades after about 4s; it is not persisted.
- `profile.nightUnlocked/bestNight` still update on extraction (harmless, unused by the route).
- Interstitial hook runs only after an extracted map (`INTERSTITIALS_ENABLED` is still false).
