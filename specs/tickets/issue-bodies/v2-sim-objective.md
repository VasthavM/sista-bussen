v2 wave 1. Design: `specs/design/v2-last-bus.md` (sections Map and Materials). Contract: `specs/tickets/v2-contract.md`. This ticket **deliberately unfreezes `src/sim/`**. The combat feel (movement, weapons, level-up cards, enemy behaviours) must not change, only the map's win condition and drops.

## Acceptance criteria
- [ ] `src/sim/map.ts` exists, byte for byte as in the contract. `RunConfig` gains `map: MapConfig`.
- [ ] **Fuel.**
  - Canisters spawn on the map: count and positions are seeded from `MapConfig.seed`.
  - Zombies drop fuel at a seeded chance.
  - The total available fuel comfortably exceeds `fuelQuota`.
  - Fuel pickup uses the existing pickup radius.
- [ ] **Materials.** Scrap, parts and supplies drop from kills and canisters, scaled by `materialMultiplier`. They're tracked in run state.
- [ ] **Extraction.**
  - The bus is a fixed entity at a seeded position, rendered with the existing style. A placeholder silhouette is fine.
  - When the fuel quota is met: a state flag flips, there's a sim event for the horn sound and UI, and touching the bus ends the map with `outcome: 'extracted'`.
  - Before the quota, touching the bus does nothing.
- [ ] **Time pressure.** The spawn director keeps ramping on elapsed time past 240 s, with no hard end. The old 03:00 win condition is removed. Bosses at fixed times are disabled on non-boss stops (boss stops are a later ticket).
- [ ] **Difficulty.** `depth` replaces `night` as the difficulty input, with the same function shape. `densityMultiplier` scales spawns.
- [ ] **Result.** On death or extraction the sim produces a `MapResult` exactly as typed in the contract.
- [ ] **Card levels reset every map** (each map is a fresh run, as today).
- [ ] **Harness.**
  - `tools/balance.mjs` (from #11) understands the new win condition: the bot heads for the bus once the quota is met.
  - It reports the extraction rate, median time to quota and median time to extract.
  - A new baseline for depth 1–5 × 6 weapons on a `street` stop, with a quota chosen so depth 1's extraction rate lands within ±10 percentage points of today's night 1 win rate per weapon. State the quota formula you chose.
- [ ] **Tests.**
  - `tests/run.test.ts` is replaced by a headless "depth 1 street map is extractable" test.
  - Determinism test: same `MapConfig`, same `MapResult`.
  - Unit tests for fuel and material drops.
- [ ] **Game wiring.** `src/game.ts` builds a fixed default `MapConfig`: depth = selected night, stop `street`, quota from your formula. The current game stays playable end to end until the route ticket lands: menu → map → extract or die → summary. The summary shows fuel and materials. A placeholder layout is fine.
- [ ] `npm run build`, `npm run build:docker-check`, `npm test` and `npx playwright test` are green. Update the e2e specs that assumed the 03:00 win.

Out of scope: route, save changes, upgrade trees, reskin and copy, bosses.
