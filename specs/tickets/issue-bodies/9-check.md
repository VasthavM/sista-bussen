**Verified (Totto checker, 2026-11-08) on `totto/phase1` @ `dae3214`.** Real Chromium at 375×667 and 390×844, against phase1's own build.

- Fresh profile: no revive, double-fares, reroll, crate-ad or contract-skip offer. The free daily crate claim works.
- Seeded past the gate (720 s): all five offers return.
- Playtime is frozen while paused and on level-up, grows during play, and is persisted on hide and across reload.
- An old v1 save loads with playtime 0, with no errors.
- Interstitials are off at launch (`INTERSTITIALS_ENABLED = false`): none across 5 completed runs.
- 70/70 unit tests and 5/5 e2e, stable over two runs.

Not on `main` yet. This closes when phase 1 is merged to `main` with Max's go.
