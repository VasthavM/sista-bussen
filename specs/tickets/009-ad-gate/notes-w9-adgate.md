# #9 Onboarding ad gate — worker notes

Branch `totto/9-ad-gate`. Gate: `REWARDED_ONBOARDING_FREE_MINUTES = 12` in `src/monetize/catalog.ts` (only definition). `adsOfferable(profile)` in `src/monetize/ads.ts` (`playtimeSeconds >= 12*60`).

## AC results
1. Save field + migration: PASS. `playtimeSeconds`, `SAVE_VERSION` 1 -> 2, default 0, clamped 0..1e9, non-finite/garbage -> 0, corrupt JSON -> fresh 0. `tests/adgate.test.ts`.
2. Accumulation/persist: PASS. `game.ts` adds frame dt only in the unblocked branch (run phase, no overlay incl. pause/levelup/summary, tab visible). Persisted on `visibilitychange` hidden and when the summary opens (plus existing finalizeRun). e2e "playtime accumulates only while running and is persisted".
3. Constant + pure function: PASS. Unit tests at 0, gate-1, gate, gate+1.
4. Hidden before gate: PASS. Summary (revive, double fares), level-up reroll, crate extra pull, contract skip and the "extra drag kvar" teaser are not rendered. Daily crate claim still works (asserted). e2e "a fresh profile is offered no rewarded ad anywhere".
5. After gate unchanged: PASS. money.spec (past gate) + "past the gate the offers come back".
6. Money-loop e2e: PASS. money.spec seeds localStorage past the gate via `addInitScript` (no debug hook, so no `main.ts` edit). Fresh-profile no-revive assertion is in adgate.spec.
7. build / test / playwright: PASS. build ok, vitest 67/67, playwright 5/5. `tests/run.test.ts` and `src/sim/` untouched.

## Notes
- `revive_offered` analytics is now skipped when ads are not offerable.
- `screenshots/03-levelup.png` regenerated (reroll footer gone); other screenshots reverted (seed noise).
- Interstitials: `INTERSTITIALS_ENABLED = false` in `catalog.ts`; `shouldShowInterstitial` returns false while off (third param `enabled` defaults to the flag). Guard logic intact; existing guard tests run with the flag passed on. New tests assert never-show at 0..100 runs.
- Playtime is only counted while the run is in play; time on menu/shop is not.
- Merge risk: `src/game.ts` also modified in the #6 checkout; my edits are ~8 lines (import, frame accumulate, onVisibility persist, openSummary persist, two `adsOfferable` props).
