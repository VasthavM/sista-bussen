Prerequisite for any change to weapons, passives or interactions (Max, 2026-11-08: "more weapon types or alterations in how they interact"). `src/sim/` is deterministic and headless, so a bot can play many nights per build without a browser. Today, balance is one 240-second win check in `tests/run.test.ts` plus feel.

## Acceptance criteria
- [ ] `tools/balance.mjs` (or `.ts` via the existing toolchain) runs N seeded nights headlessly with a simple scripted bot. The bot kites away from the nearest enemies and picks level-up cards by a pluggable policy: random, greedy-damage, or "rush evolution for weapon X".
- [ ] It's configurable by night, character, starting weapon, meta upgrade levels, N and base seed. Same inputs give same outputs.
- [ ] Output is a JSON report plus a short markdown table per config:
  - win rate
  - median and p10/p90 time of death
  - median level at 03:00
  - evolution rate per weapon
  - damage share per weapon
  - peak live enemies
- [ ] A baseline report for the current build is committed: all 6 starting weapons × night 1–5, Nattvandraren, no meta upgrades, N ≥ 200 each. It goes in `specs/balance/baseline.md`.
- [ ] One vitest smoke test runs a tiny config (N = 5) and asserts the report shape and determinism, and finishes in under 10 s.
- [ ] Runtime for the full baseline is under 5 minutes on this Mac. Note the actual time.
- [ ] `src/sim/` is unchanged: the harness only imports it. `tests/run.test.ts` still passes.

Out of scope: changing any balance number. This ticket only measures.
