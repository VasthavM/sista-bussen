# #15 upgrade trees + save v4: worker notes

Branch `totto/15-upgrades` off `totto/v2` @ 04c16e7. Worktree `/Users/vasthavm/Code/Worktrees-dsf/15-upgrades`.

## What changed
- `src/meta/upgrades-v2.ts` (new): 26 nodes as data (costs, growth, prerequisites, effects), `canBuy`, `buyBlock` (why not: unknown/maxed/locked/poor), `buy` (returns a new profile or null), `modsFromProfileV2`, `V2Mods`.
- `src/meta/migrate-v4.ts` (new): old shop levels -> nodes, Startnyckel refund.
- `src/meta/save.ts`: `SAVE_VERSION` 4. `tickets` removed. `upgrades` is now node id -> level. Starters Nyckel/Grillkorv/Ficklampa. New `addScrap(profile, n)` helper.
- Old shop kept compiling as a crude read path: `src/meta/shop.ts` is now an adapter over the trees (lists the 13 single-material level nodes, one price number each, `modsFromProfile = modsFromProfileV2`). `src/ui/shop.ts`: wallet shows the three materials, weapon unlock goes through `buy`.
- `tickets` call sites moved to `addScrap` / `materials.scrap`: `meta/economy.ts`, `meta/daily.ts`, `ui/contracts.ts`, `ui/menu.ts` (wallet chip), `game.ts` (one analytics field), `main.ts`.
- Debug API: `grantMaterials(partial)` added, `profile()` snapshot now includes `materials` (`tickets` key kept, reads Scrap).
- `src/sim/` untouched. `V2Mods extends MetaMods` and redeclares `evolutionUnlocks: WeaponId[]`, which stays compatible once #14 adds the field to `MetaMods`.

## Design decisions (override if wrong)
- Prerequisites: a combination needs level 1 in one node of each parent tree; evolutions also need the weapon on the rack. Evolution: `w_damage`+`c_hp`. `mod_projectile`: `w_damage` 2 + `b_storage`. `mod_pierce`: `w_attack` 2 + `b_fuel`. `crew_shield`: `b_armor`+`c_armor`. `crew_magnet`: `b_fuel`+`c_pickup`.
- Weapon unlock: 1200 Scrap each, any order, Telefon/Spray/Vagn. Evolution nodes exist for all six weapons.
- v3 -> v4 wallet: v3 held the wallet twice (`tickets` live, `materials.scrap` a stale snapshot from the v2 migration). v4 Scrap = max of the two + Startnyckel refund (900 + 2160 for levels 1-2). Never the sum.
- Old level -> node level: same level, capped at the node max. Per-level effects were kept equal to the old shop (damage 8%, HP 12, speed 4%, pickup 10, armor 1, storage 8%). `kraft` + `tur` add into `w_damage` before the cap. Old max levels were 6-10, new are 5, so levels above 5 are clipped.
- Spray was a free starter in v3; v3 saves keep it, a fresh v4 profile does not own it.
- `fares` on `V2Mods` carries the storage bonus so the old payout keeps working. `crit` and `startWeaponLevel` are 0 (no node).
- Extra effects on `V2Mods` beyond the AC list: attackSpeed, reviveHp, extraProjectiles, pierce, turret, plow, radio, busArmor.

## Cost assumption (AC: state expected materials per depth-1 map)
Measured on the sim, street, depth 1, rush bot, 30 seeds per start weapon, runs that extracted:

| start weapon | extracted | scrap | parts | supplies |
|---|---|---|---|---|
| nyckel | 15/30 | 699 | 18.8 | 12.7 |
| korv | 7/30 | 661 | 16.6 | 13.1 |
| ficklampa | 18/30 | 712 | 16.3 | 13.1 |

Design numbers (rounded down, `EXPECTED_PER_DEPTH1_MAP` in code): **650 Scrap, 16 Parts, 12 Supplies per map.** Three maps = 1950 / 48 / 36. Every level-1 price is within that (test). Scrap is about 40x the others per map, so Scrap prices are in the hundreds and Parts/Supplies in the tens. That ratio is a drop-rate matter for #14/v2-8; if it changes, only the `baseCost` numbers move.

## Cost table (level 1 and 2; total to max)
| node | max | L1 | L2 | total to max |
|---|---|---|---|---|
| c_hp | 5 | 8 supplies | 13 supplies | 126 supplies |
| c_speed | 5 | 8 supplies | 13 supplies | 126 supplies |
| c_pickup | 5 | 6 supplies | 10 supplies | 95 supplies |
| c_revive | 5 | 10 supplies | 17 supplies | 189 supplies |
| c_armor | 5 | 12 supplies | 20 supplies | 226 supplies |
| w_damage | 5 | 400 scrap | 640 scrap | 6323 scrap |
| w_attack | 5 | 500 scrap | 800 scrap | 7905 scrap |
| w_unlock_telefon / spray / vagn | 1 | 1200 scrap | - | 1200 scrap |
| b_fuel | 5 | 12 parts | 20 parts | 226 parts |
| b_storage | 5 | 12 parts | 20 parts | 226 parts |
| b_turret | 1 | 40 parts | - | 40 parts |
| b_plow | 1 | 30 parts | - | 30 parts |
| b_radio | 2 | 15 parts | 30 parts | 45 parts |
| b_armor | 5 | 14 parts | 24 parts | 264 parts |
| evo_<each of 6 weapons> | 1 | 800 scrap + 20 supplies | - | same |
| mod_projectile / mod_pierce | 2 | 600 scrap + 20 parts | 1080 scrap + 36 parts | 1680 scrap + 56 parts |
| crew_shield | 3 | 20 parts + 12 supplies | 34 parts + 20 supplies | 112 parts + 67 supplies |
| crew_magnet | 3 | 18 parts + 12 supplies | 31 parts + 20 supplies | 101 parts + 67 supplies |

Per-level effects: hp +12, speed +4%, pickup +10, revive +8 HP, armor +1; damage +8%, attack speed +5%; fuel tank -4% quota, storage +8% gain, bus armor +25, radio +1 step; projectile +1, pierce +1; shield +15, magnet +40 radius.

## eval.md (issue #15 acceptance criteria)
1. Trees as data in `src/meta/upgrades-v2.ts`: PASS. Test `upgrade data` (ids, trees, level counts, material per tree).
2. Costs scale per level, affordable after 2-3 maps, assumption stated: PASS. Tests `costs` (strictly rising, level 1 of every node within 3 maps of the stated yield, two-level check on basic nodes). Yield table above.
3. `canBuy`, `buy` (new profile), `modsFromProfileV2` with the listed fields, `V2Mods` meta-side, no `src/sim/` edit: PASS. `git diff 04c16e7 --stat -- src/sim` is empty.
4. Save v4: PASS. Tickets and shop levels gone; levels and owned weapons present; migration from the v3 fixture (`tests/fixtures/save-v3.json`) in `tests/save-v4.test.ts`, mapping per the AC (kraft->damage, liv->HP, fart->speed, plock->pickup, skinn->armor, tur->damage level, vaxling->storage, startnyckel->Scrap refund). Unlocked weapons carry over.
5. Tests: every node buyable (buy-everything-to-max loop), costs monotonic, combination prerequisites enforced (evolution, mods, crew, plus `poor` vs `locked`), no mutation, migration: PASS.
6. Builds and tests: PASS. See below.

## Proof
- `npx vitest run`: 15 files, 155 tests passed (was 127; 28 new in `upgrades-v2.test.ts` and `save-v4.test.ts`, 6 old assertions updated for the new shape).
- `npm run build`: green (tsc app + node + vite).
- `PW_PORT=4187 npx playwright test`: 41 passed (chromium + webkit).
- `npm run build:docker-check`: image built.
- Test order: the implementation was written before the new tests, not strictly test-first. Existing save tests were run first and drove the shape of the change.

## Touched outside the named files (merger heads-up)
- `src/main.ts` (grantMaterials, snapshot, import), `src/game.ts` (1 line), `src/ui/menu.ts` (1 line), `src/ui/contracts.ts`, `src/ui/shop.ts`, `src/debug.ts`: all small and mechanical, because `tickets` is gone from `Profile`. #16 and #17 will see these in game.ts/main.ts/menu.ts/shop.ts.
- `tests/e2e/money.spec.ts`: upgrade is now `c_hp` paid in Supplies via `grantMaterials`. `tests/e2e/menu.spec.ts`: keyboard test picks Grillkorv, since Spray is no longer owned at start.
- `screenshots/menu-weapons-*.png` regenerated (Spray now locked). Other regenerated screenshots reverted as noise.
- Merge order from the board is #14, #15, #17, #16.

## Open risks
- `src/ui/menu.ts` still says "LÅST · 1200 Biljetter" for locked weapons; copy is #17's.
- The old shop shows Parts/Supplies prices as a bare number with the wrong word in the toast; it is a stopgap until the hub UI.
- IAP products and daily crates still grant "tickets", now credited as Scrap. Pricing in `catalog.ts` was not touched.
- Nothing in the sim reads the new fields yet (shield, magnet, turret, plow, quota multiplier, attack speed, projectiles, pierce). Wiring is a later ticket.
