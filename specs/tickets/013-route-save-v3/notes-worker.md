# #13 route generator, checkpoints, save v3: worker notes

Branch `totto/13-route` off `totto/v2` (deafa2b). Commits: 666d525 (map.ts), 0da3178 (route + save v3 + tests).

## What changed
- `src/sim/map.ts`: byte for byte from the contract. Nothing else under `src/sim/` touched.
- `src/meta/route.ts` (new, pure): `generateSegment`, `STOP_TABLE` (single source: weight, danger range, reward hint, quota, density, material multipliers), `SAFE_GRANT`, `buildMapConfig`, `RouteState`, `createRoute`, `currentOptions`, `applyMapResult`, `resolveSafeStop`.
- `src/meta/save.ts`: `SAVE_VERSION` 3; `materials`, `route`, `routeSeed` on `Profile`; v2 -> v3 migration; route/material clamping.
- Tests: `tests/route.test.ts`, `tests/save-v3.test.ts`, fixture `tests/fixtures/save-v2.json` (written by the real v2 `saveProfile`).

## Design calls (check these)
- Segment = 10 layers. Layers 1-9 each offer 2-4 options, layer 10 is the single boss (a forced stop, so "2-4 options" cannot apply to it). Layers are independent of earlier picks (not a DAG); the path is stored as option indices.
- `RouteState.depth` is the next map to play (starts at 1). Death: depth = checkpoint + 1. `bestDepth` lives in `RouteState`.
- `applyMapResult(route, bank, routeSeed, choice, result)` and `resolveSafeStop(...)` are immutable and return `{route, materials}`. Out-of-range choice throws.
- `buildMapConfig(option, depth, routeSeed, baseQuota?)`: `baseQuota` is the swap point for #12 (placeholder `10 + 2*(depth-1)`). Danger scales density by +10% per pip above 1, so the pips are truthful. Safe stops throw.
- Map seed = hash(routeSeed, depth): a retry after death replays the same map and options.
- Table numbers are first-pass, for v2-8 to tune.
- `routeSeed` has no randomness: derived from `createdAt`. A v2 save migrates to the same seed every time.
- Migration: `tickets` is kept untouched (the current game still reads and spends it) and `materials.scrap` is seeded from it once. After that the two drift until the upgrade-tree ticket removes Biljetter.

## Eval, item by item
- [x] `src/sim/map.ts` byte for byte: extracted from the contract's ts block by script, committed first (666d525).
- [x] Route generator: 1000-seed invariants (10 layers, 2-4 options, boss alone on 10, <=1 safe never on 1 or 10, type mix street > each resource > horde, danger 1-3, rewardHint valid), determinism. `tests/route.test.ts`.
- [x] MapConfig builder: seed from routeSeed+depth, table-driven quota and multipliers, swappable base quota, safe refused.
- [x] Route state: extraction advances and banks; death resets to checkpoint, keeps bank, loses haul; boss clear sets checkpoint (10 -> next segment, death returns to 11); safe stop grant.
- [x] Save v3: new fields, v2 -> v3 (Biljetter -> Scrap 1:1, nights -> bestDepth, upgrade levels kept), corrupt fallback, v2 fixture test, hostile route data repaired.
- [x] `npm test`: 12 files, 104 tests pass. `npm run build`: green.
- [x] e2e: `PW_PORT=4184 npx playwright test`: 38 passed (chromium + webkit). Regenerated screenshots reverted, not committed.
- [x] `npm run build:docker-check`: passed.

## Example segment (routeSeed 20261110, segment 0; [type danger reward-hint])
```
map  1: [pharmacy d1 supplies]  [scrapyard d2 scrap]
map  2: [street d2 scrap]  [depot d2 parts]  [pharmacy d1 supplies]
map  3: [pharmacy d1 supplies]  [scrapyard d2 scrap]
map  4: [pharmacy d2 supplies]  [gas_station d2 fuel]  [street d2 scrap]
map  5: [horde d3 scrap]  [street d1 scrap]  [pharmacy d1 supplies]  [gas_station d2 fuel]
map  6: [pharmacy d2 supplies]  [street d2 scrap]  [safe d1 supplies]  [scrapyard d1 scrap]
map  7: [scrapyard d2 scrap]  [street d1 scrap]  [depot d2 parts]
map  8: [depot d3 parts]  [horde d3 scrap]  [pharmacy d2 supplies]
map  9: [scrapyard d1 scrap]  [street d1 scrap]
map 10: [boss d3 parts]
```

## Open risks
- Street frequency is only "most common" in aggregate; single segments can look pharmacy-heavy like the one above. If that reads wrong on the route map, raise street's weight.
- `tickets` and `materials.scrap` are duplicated until the upgrade-tree ticket.
- `defaultBaseQuota` is a stand-in; #12's formula replaces it.
- Merging with #12: both add identical `src/sim/map.ts`; no other overlap expected.
