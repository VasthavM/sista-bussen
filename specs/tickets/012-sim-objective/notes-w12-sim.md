# #12 Sim: fuel quota, materials, bus extraction (notes, w12-sim)

Branch `totto/12-sim` off `totto/v2` (deafa2b). Worktree `/Users/vasthavm/Code/Worktrees-dsf/12-sim`.

## What changed

- `src/sim/map.ts`: byte for byte from the contract (first commit, never edited).
- `src/sim/objective.ts` (new): quota formula, fuel and material drops, canister pickup, quota flag + `horn` event, bus contact, `defaultMapConfig`.
- `src/sim/state.ts`: `RunConfig.map`, seeded `layoutMap` (bus + canisters on their own RNG stream), `computeMapResult`. `RunConfig` lost `seed` and `night` (now `map.seed`, `map.depth`).
- `src/sim/step.ts`: the 03:00 win is gone; extraction ends the map. `spawn.ts`: `depth` replaces `night`, `densityMultiplier` scales the ring spawn rate, fixed-time bosses only on `stop: 'boss'`. `curve.ts`: `depthDifficulty`, spawn intensity no longer clamps at 240 s (identical up to 240, then steeper, uncapped).
- Combat: `killEnemy` books materials and rolls fuel on a separate `dropRng`; `spawnOrb` takes an optional rng; `fuel` orb kind.
- Game/UI placeholder: `game.ts` builds `defaultMapConfig(seed, night)`; HUD night bar is now the fuel gauge; summary shows fuel bar + Skrot/Delar/Förråd; renderer draws canisters, a bus silhouette (green ring when the quota is met), a screen-edge arrow, a `horn` SFX and flash. New debug call `completeObjective()`.
- Harness: `--depths` replaces `--nights`, `--quota` override, bot walks to canisters then the bus, reports extraction rate, reached-quota rate, median time to quota and to extract.
- Tests: `tests/run.test.ts` rewritten (extractable depth 1 map, determinism, same MapConfig -> same MapResult, dies without input, card reset), new `tests/objective.test.ts` (layout, fuel, materials, extraction), spawn/curve/balance tests updated, `tests/helpers.ts`, `tests/e2e/map.spec.ts`.

## Quota formula and the depth 1 comparison (kill-driven retune)

`fuelQuotaFor(depth) = 92 + 8 * (depth - 1)`. Fuel is mostly kill-driven: per-kill drop chance by enemy type (duva 6%, fyllo/skugga 12%, vaktmästare/elsparkcykel 24%, elites always 2, bosses 10), on the separate `dropRng`. Canisters are a ~30% bonus (5 fuel each, 6-7 at depth 1), all on the map from the start, every other one *risky* (border band, 350+ from the bus). Measured: **59-70% of the fuel at quota time comes from kills** (62% at depth 1). Full write-up and depth 1-5 tables: `specs/balance/v2-baseline.md` (raw: `v2-baseline.json`).

Depth 1 extraction rate vs old night 1 win rate (rush, N=500, seed 1000, same seeds):

| weapon | old night 1 | new depth 1 | diff |
|---|---|---|---|
| nyckel | 32% | 36% | +4 |
| korv | 28% | 25% | -3 |
| telefon | 5.8% | 6.8% | +1.0 |
| spray | 15% | 16% | +1 |
| vagn | 3.8% | 4.8% | +1.0 |
| ficklampa | 50% | 58% | +8 |

Median time to quota 3:43-3:52 (asked: 2:45-3:30), median time to extract 3:50-4:07. **The two targets conflict**: with fixed bosses gone, a quota that lands near 3:00 gives 79-84% extraction for ficklampa (+29..+34 points), at 3:30 it is +20. I put the ±10 point AC first. Table of the tradeoff in the baseline file. Faster killers do reach the quota sooner: corr(kills/min, time to quota) at depth 1 is -0.35 to -0.63 per weapon.

## Combat feel unchanged: evidence

Old sim (`totto/v2`) vs this branch, same seeds, same kiting bot, ficklampa rush, 200 s: kills, level, hp, damage dealt, live enemies and the final combat RNG state are identical (seeds 1000-1002). The drop and layout RNG streams never touch the combat stream.

```
OLD 1000 running 200.00 281 10 49.600 13623 139 2487632768   NEW 1000 ... identical
OLD 1001 dead    156.02 191  8  0.000  8268 115 2954619251   NEW 1001 ... identical
OLD 1002 running 200.00 340 11 94.583 16371  80 3360080628   NEW 1002 ... identical
```

## AC by AC

- map.ts byte for byte + `RunConfig.map`: pass (`git show 94a3628`, `src/sim/types.ts`).
- Fuel: pass. Seeded canister count and positions (`tests/objective.test.ts` layout tests), seeded zombie drops by enemy type, supply is unbounded because kills keep paying (canisters alone are only ~30% of the quota), pickup inside `player.pickup` (test).
- Materials: pass. Scrap per kill, parts from elites and bosses, scrap + supplies (+30% a part) per canister, all x `materialMultiplier`, tracked in `state.materials` (tests).
- Extraction: pass. Fixed seeded bus, rendered; `quotaMet` flag, `horn` event, touching it after the quota gives `extracted`, before it nothing (tests, e2e `map.spec.ts`).
- Time pressure: pass. `spawnIntensityAt` keeps climbing past 240 s (curve tests), no hard end, bosses only on boss stops (spawn test).
- Difficulty: pass. `depth` drives `depthDifficulty`, speed and damage scaling; `densityMultiplier` x2 gives >1.5x spawns (spawn test).
- Result: pass. `computeMapResult` returns exactly `MapResult`.
- Card levels reset every map: pass (each `createRun` is fresh; test).
- Harness: pass. Baseline `specs/balance/v2-baseline.md`.
- Tests: pass. 100 unit tests green.
- Game wiring: pass. Menu -> map -> extract or die -> summary with fuel and materials (`screenshots/06-extracted.png`, e2e).
- Builds: `npm run build` ok, `npm test` 100/100, `PW_PORT=4185 npx playwright test` 41/41 (chromium + webkit), `npm run build:docker-check` exit 0.

## Open risks and decisions for Totto

1. **Time to quota vs old win rates**: see above. If Max would rather have a 3:00 quota, the old night 1 win rates are no longer the target (ficklampa would extract ~80%). Decision for you.
2. Ficklampa is the worst fit (+8 points); everything is inside +-10. N=500 noise is about +-2 points.
3. `RunConfig` no longer has `seed` or `night`. #13 and anything else constructing a `RunConfig` must pass `map`. `RunResult.night` is now the depth and `won` means extracted, so `src/meta` is untouched.
4. Not done, outside the AC: the design's "horde ramps up when the quota is met", per-stop quota and drop rules (route layer), a proper HUD/arrow/summary (v2-4), English copy (v2-5). Swedish placeholder strings and the 23:00 clock stay; the clock now runs past 03:00.
5. `AGENTS.md` hard rule "src/sim is frozen, re-run the 240-second win check in tests/run.test.ts" is stale; I did not edit it.
6. Screenshots `02-05`, `boot-screen`, `update-banner` were regenerated by the e2e run (new HUD); `06-extracted.png` is new.
