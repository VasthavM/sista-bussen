Split from #2 (decision recorded there 2026-11-08).

Accumulate lifetime playtime seconds in the save and hide every rewarded-ad offer until the player passes `REWARDED_ONBOARDING_FREE_MINUTES = 12`, a constant in `src/monetize/catalog.ts`. Playtime survives closing the app mid-run.

## Acceptance criteria
- [ ] `playtimeSeconds` (or equivalent) is a field in the save, with a forward migration from existing saves (default 0) and clamping in the corrupt-save path. A unit test covers the migration.
- [ ] Playtime accumulates only while a run is active and unpaused, and is persisted at least at run end and on `visibilitychange` hidden.
- [ ] `REWARDED_ONBOARDING_FREE_MINUTES = 12` lives in `catalog.ts` and nowhere else. One pure function (e.g. `adsOfferable(profile)`) decides, unit tested on both sides of the threshold.
- [ ] Before the gate: revive, double_fares, reroll-by-ad, free_crate-by-ad and contract_skip offers are not rendered at all (no disabled button, no teaser). Non-ad paths (e.g. the free daily crate claim) still work.
- [ ] After the gate: all five placements behave exactly as today.
- [ ] The money-loop e2e still passes. Add a debug hook or seed so it can start past the gate, plus one e2e assertion that a fresh profile sees no revive offer on death.
- [ ] `npm run build`, `npm test` and `npx playwright test` are green. `tests/run.test.ts` is untouched and passes.

Do not touch `src/sim/`.
