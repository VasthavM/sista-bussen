# Board

Mirrors GitHub Issues in `VasthavM/sista-bussen`. The eval is the acceptance criteria in each issue's body and comments.

**Phase 1 shipped:** `main` @ `0528ab8`, live 2026-11-08 22:46 on https://sista-bussen.vasthavm.com. Max can close #1, #5, #6, #9 and #10.

## v2: ZOMBUS (zombie route), integration branch `totto/v2` off `main`

Design: `specs/design/v2-last-bus.md` (approved 2026-11-09). Contract: `specs/tickets/v2-contract.md`.

| # | Ticket | status | mode | runs (after) | owner / branch |
|---|---|---|---|---|---|
| 11 | Balance harness + baseline | done | solo | — | `totto/11-balance` @ `7d988a3`; being merged into `totto/v2` |
| 12 | Sim: fuel quota, materials, bus extraction (unfreezes sim) | done (browser-checked 2026-11-09, `/tmp/chk12/shots/`) | solo | 11 | `totto/12-sim` @ `701f7b6`: kill-driven fuel (62% from kills), quota `92 + 8*(depth-1)`, depth-1 extraction within ±8 pts of old night 1, combat identical. Open for v2-8: pacing (~3:45 to quota) vs a shorter map |
| 13 | Route generator, checkpoints, save v3 | done | solo | — | `totto/13-route` @ `ab59aa0` (104/104 unit, 38/38 e2e, docker ok); merging into `totto/v2`. Open: layers vs real branching paths (Max) |
| 14 | Weapon balance + reachable evolutions (numbers only) | done, merged `e6d3c52` | solo | 12 | `totto/14-weapons` @ `fd64d21`: depth 1 extraction 44–46% for all six, evolution 46–69% with unlock. Open for v2-8: steep depth curve (depth 3 ≈1–8%), early evolution jumps to level 8 |
| 15 | Upgrade trees from 3 materials + combos, save v4 | done, merged `09c942f` | solo | 12, 13 | `totto/15-upgrades` @ `24977a2` (155/155 unit, 41/41 e2e, docker ok). New sim effects (shield, magnet, turret, plow, quota, attack speed, projectiles, pierce) not read by the sim yet. Tests written after code (process miss) |
| 16 | Playable route loop: route screen, fuel HUD, summaries | built, gates open | solo | 12, 13 | `totto/16-flow` @ `f1d1289`: 169 unit green, route.spec green on chromium. Open: full e2e (paused for Max's meeting; audio) and docker-check (Docker Desktop down) |
| 17 | Zombie reskin, English copy + weapon names, ZOMBUS branding, cold open | built, gates open | solo | 12 | `totto/17-reskin` @ `f3a7000`: 168 unit green incl. Swedish check. Open: full e2e + menu/combat shots (paused), docker-check (Docker down). Names for Max: `specs/design/names-v2.md` |
| v2-hub | Bus hub UI for upgrades (#15) | planned | solo | 15, 16 | wave 3 |
| v2-6 | Bosses every 10 maps | planned | solo | 12, 13 | |
| v2-7 | Monetization v2: rewarded remap, interstitials, StoreKit IAP | planned | solo | 8, v2-4 | waits on Apple verification |
| v2-8 | Balance pass per depth band + human playtest | planned | solo | all | |

## Parked / superseded

| # | Ticket | fate |
|---|---|---|
| 8 | Capacitor scaffold + spike | `totto/8-capacitor` @ `702643a`, parked; IAP lands here in v2-7 |
| 7 | Lore (night/03:00) | superseded by the v2 lore; Max to close |
| 4 | Tune nights 4+ | superseded by v2-8 |
| 3 | Art pass | folded into v2-5 |
| 2 | Real ads + billing | split into v2-7 |

## Conflict map, wave 2

- #14: numbers in `src/sim/content.ts`, `src/sim/upgrades.ts`, `MetaMods.evolutionUnlocks` in `src/sim/types.ts`, `tools/balance*`, `specs/balance/`.
- #15: `src/meta/upgrades-v2.ts` (new), `src/meta/save.ts`, the old shop's read path only.
- #16: `src/ui/{route,hud,summary,menu}.ts`, `src/game.ts`, `src/main.ts`, e2e flow specs.
- #17: `src/render/**`, string fields in `src/sim/content.ts`, other `src/ui/*`, `index.html`, manifest, icons.
- Known overlaps the merger resolves: `content.ts` (#14 numbers vs #17 strings), shop UI (#15 read path vs #17 copy), `game.ts` mods wiring (#15 vs #16). Merge order: #14, #15, #17, #16.

## Conflict map, wave 1

- #12 owns `src/sim/**`, `src/game.ts`, `src/render/**` (bus and pickups), `src/ui/summary.ts`, `tools/balance*`, the sim tests and the e2e updates.
- #13 owns `src/meta/route.ts` (new), `src/meta/save.ts`, the route and save tests.
- Both create `src/sim/map.ts` byte-identical from the contract.
