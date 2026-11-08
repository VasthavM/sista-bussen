# Board

Mirrors GitHub Issues in `VasthavM/sista-bussen`. The eval is the acceptance criteria in each issue's body and comments.

**Phase 1 shipped:** `main` @ `0528ab8`, live 2026-11-08 22:46 on https://sista-bussen.vasthavm.com. Max can close #1, #5, #6, #9 and #10.

## v2: ZOMBUS (zombie route), integration branch `totto/v2` off `main`

Design: `specs/design/v2-last-bus.md` (approved 2026-11-09). Contract: `specs/tickets/v2-contract.md`.

| # | Ticket | status | mode | runs (after) | owner / branch |
|---|---|---|---|---|---|
| 11 | Balance harness + baseline | done | solo | — | `totto/11-balance` @ `7d988a3`; being merged into `totto/v2` |
| 12 | Sim: fuel quota, materials, bus extraction (unfreezes sim) | ready | solo | 11 | wave 1 |
| 13 | Route generator, checkpoints, save v3 | ready | solo | — | wave 1, parallel with #12 under the contract |
| v2-3 | Upgrade trees: character / weapons / bus from 3 materials + combos | planned | solo | 12, 13 | ticket after wave 1 |
| v2-4 | UI: route map, bus hub, map HUD (fuel, extract arrow), end-of-map summary | planned | solo/team | 12, 13 | |
| v2-5 | Reskin to zombies + English copy + ZOMBUS branding + cold open/radio lore | planned | solo | 12 | can run beside v2-3 |
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

## Conflict map, wave 1

- #12 owns `src/sim/**`, `src/game.ts`, `src/render/**` (bus and pickups), `src/ui/summary.ts`, `tools/balance*`, the sim tests and the e2e updates.
- #13 owns `src/meta/route.ts` (new), `src/meta/save.ts`, the route and save tests.
- Both create `src/sim/map.ts` byte-identical from the contract.
