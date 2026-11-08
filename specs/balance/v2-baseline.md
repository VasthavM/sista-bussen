# v2 balance baseline: fuel quota + bus extraction (ticket #12, kill-driven retune)

Build `totto/12-sim`. Replaces the 03:00 win with "meet the fuel quota, then touch the bus". Measures only; no combat number was changed. Compare with the night baseline in `baseline.md` (build `totto/phase1`). Raw data: `v2-baseline.json`.

## Quota formula and where fuel comes from

`fuelQuotaFor(depth) = 92 + 8 * (depth - 1)` fuel (`src/sim/objective.ts`). Street stop, no multipliers.

- **Kill drops carry 59-70% of the fuel at quota time** (column "fuel from kills"; 62% at depth 1 for most weapons). Drops are rolled per kill on their own RNG stream, with a chance by enemy type: duva 6%, fyllo and skugga 12%, vaktmästare and elsparkcykel 24%, so tougher zombies pay more. Elites always drop 2 and bosses 10. One fuel per normal drop.
- **Canisters are a bonus**: 5 fuel each, about 30% of the quota in total (`ceil(0.3 * quota / 5)` plus 0 or 1, so 6-7 at depth 1), all on the map from the start. Every other one is *risky*: within 150 units of the border and at least 350 from the bus, so grabbing it is a detour. The others are anywhere on the map, at least 150 from the start and 130 from the bus.
- Supply is not a limit: kills keep paying for as long as the map runs, and the director has no hard end.

Knobs, in the order I would turn them: `quota` (shifts every weapon the same way), `FUEL_DROP_BASE` (same effect, but scales with how many zombies you kill), `CANISTER_SHARE`. Tuned on depth 1, N=500, seed 1000, same seeds as the night baseline.

## Depth 1 extraction rate against the old night 1 win rate (rush policy, N=500)

| start weapon | old night 1 win rate | new depth 1 extraction rate | difference (points) |
|---|---|---|---|
| nyckel | 32% | 36% | +4 |
| korv | 28% | 25% | -3 |
| telefon | 5.8% | 6.8% | +1.0 |
| spray | 15% | 16% | +1 |
| vagn | 3.8% | 4.8% | +1.0 |
| ficklampa | 50% | 58% | +8 |

All six are inside the +-10 point band; the worst is ficklampa at +8. Median time to extract at depth 1 is 3:50 to 4:07.

## Time to quota, and the conflict with the old win rates **[measured]**

Median time to quota at depth 1 is **3:43 to 3:52** for every weapon (over the runs that reached it). That is longer than the 2:45-3:30 asked for, and I could not bring it down without breaking the old win rates:

| quota (depth 1) | median time to quota | extraction nyckel / korv / telefon / spray / vagn / ficklampa | worst gap |
|---|---|---|---|
| 50 | 2:52-2:58 | 65 / 60 / 14 / 41 / 13 / 84 (N=150) | +34 (ficklampa) |
| 60 | 3:06-3:14 | 55 / 51 / 12 / 34 / 11 / 79 (N=150) | +29 |
| 80 | 3:25-3:35 | 35 / 37 / 5.3 / 13 / 7.3 / 70 (N=150) | +20 |
| 92 (shipped) | 3:43-3:52 | 36 / 25 / 6.8 / 16 / 4.8 / 58 (N=500) | +8 |

Why: the old win rate is the chance to survive 240 seconds, bosses at 3:30 and 3:45 included. Fixed-time bosses are gone on street stops, so a map that ends at 3:00 is much easier to survive than the old night, and ficklampa (the one weapon that survives long) runs away first. A quota that lands at 3:00 puts depth 1 extraction at 80-85% for the strong weapons. Either the quota sits near four minutes, or the old win rates are not the target. The bosses-at-fixed-times removal is the ticket's own AC, so the quota absorbs it.

Fuel is also nearly weapon-independent in pace: every weapon eventually kills what the director spawns, so time to quota is about the same for all six. What differs is who is still alive at that point.

## Do faster players extract faster? **[measured]**

Yes. Correlation between kills per minute (until the quota) and time to quota, over the runs that met it, depth 1: nyckel -0.49, korv -0.63, telefon -0.63, spray -0.51, vagn -0.39, ficklampa -0.35. Negative means more kills per minute gives an earlier quota. It is moderate, not strong, because the spawn rate caps how fast anyone can kill: a faster player is limited by what has spawned (plus risky canisters) as well as by their own damage. Depths 4-5 have too few runs for the correlation to mean anything (n/a where under 3).

## What changed for the bot **[measured setup]**

- Same kiting bot as the night baseline (orbit + enemy and shot avoidance). While the quota is open it leans toward the nearest canister (orbit weight 0.3, goal pull 1.2), risky ones included; once met it leans toward the bus. `botInput` in `tools/balance-lib.ts`.
- No fixed-time bosses on a street stop (they are `stop: 'boss'` only now), so late survival is better than the night baseline for the same weapon. The quota absorbs that.
- Hard stop at 900 s counts as not extracted. It is a safety net: the largest p90 end time in this table is under 4:30.
- "Reached quota" = share of runs that met the quota (some then die on the way to the bus). Time to quota and time to extract are medians over the runs that got there. "Fuel from kills" is the median share of the fuel at quota time that came from zombie drops rather than canisters.

## Baseline: rush policy, depth 1-5, N=500 per config

### Start weapon: nyckel (Nyckel)

Policy `rush:nyckel`, nattvandraren, N=500 per depth, base seed 1000.

| depth | quota | extraction rate | reached quota | time to quota (median) | fuel from kills | corr(kills/min, time to quota) | time to extract (median) | end time median (p10-p90) | median final level | peak enemies (median / max) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 92 | 36% | 43% | 3:46 | 62% | -0.49 | 4:01 | 3:33 (2:36-4:20) | 10 | 156 / 180 |
| 2 | 100 | 11% | 15% | 3:41 | 65% | -0.61 | 3:57 | 2:52 (2:12-3:53) | 9 | 159 / 180 |
| 3 | 108 | 4.6% | 7.6% | 3:24 | 63% | -0.58 | 3:34 | 2:34 (2:00-3:18) | 9 | 161 / 180 |
| 4 | 116 | 0% | 0.8% | 3:26 | 70% | -0.66 | n/a | 2:12 (1:44-2:46) | 8 | 153 / 180 |
| 5 | 124 | 0% | 0.4% | 2:58 | 64% | n/a | n/a | 1:56 (1:33-2:25) | 7 | 148 / 180 |

Evolved % of all runs / damage share, per weapon:

| weapon | depth 1 | depth 2 | depth 3 | depth 4 | depth 5 |
|---|---|---|---|---|---|
| nyckel (start) | 0% / 89% | 0% / 92% | 0% / 94% | 0% / 93% | 0% / 94% |
| korv | 0% / 2.6% | 0% / 2.3% | 0% / 1.7% | 0% / 1.6% | 0% / 1.4% |
| telefon | 0% / 1.2% | 0% / 1.3% | 0% / 0.7% | 0% / 1.1% | 0% / 0.9% |
| spray | 0% / 2.6% | 0% / 1.3% | 0% / 0.9% | 0% / 1.3% | 0% / 1.3% |
| vagn | 0% / 1.5% | 0% / 0.9% | 0% / 0.9% | 0% / 0.7% | 0% / 0.8% |
| ficklampa | 0% / 2.8% | 0% / 2.1% | 0% / 1.6% | 0% / 2.0% | 0% / 1.7% |

### Start weapon: korv (Grillkorv)

Policy `rush:korv`, nattvandraren, N=500 per depth, base seed 1000.

| depth | quota | extraction rate | reached quota | time to quota (median) | fuel from kills | corr(kills/min, time to quota) | time to extract (median) | end time median (p10-p90) | median final level | peak enemies (median / max) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 92 | 25% | 29% | 3:43 | 62% | -0.63 | 3:50 | 3:23 (2:38-4:10) | 10 | 136 / 180 |
| 2 | 100 | 4.2% | 5.6% | 3:49 | 65% | -0.55 | 3:58 | 2:40 (2:10-3:36) | 8 | 150 / 180 |
| 3 | 108 | 0.2% | 0.4% | 3:34 | 63% | n/a | 3:12 | 2:10 (1:37-2:49) | 7 | 146 / 180 |
| 4 | 116 | 0% | 0% | n/a | n/a | n/a | n/a | 1:41 (1:13-2:15) | 6 | 135 / 180 |
| 5 | 124 | 0% | 0% | n/a | n/a | n/a | n/a | 1:24 (1:02-1:54) | 5 | 123 / 180 |

Evolved % of all runs / damage share, per weapon:

| weapon | depth 1 | depth 2 | depth 3 | depth 4 | depth 5 |
|---|---|---|---|---|---|
| nyckel | 0% / 0.7% | 0% / 1.6% | 0% / 3.0% | 0% / 2.0% | 0% / 1.9% |
| korv (start) | 0% / 93% | 0% / 92% | 0% / 90% | 0% / 92% | 0% / 93% |
| telefon | 0% / 1.4% | 0% / 1.1% | 0% / 1.5% | 0% / 1.0% | 0% / 0.6% |
| spray | 0% / 1.5% | 0% / 2.0% | 0% / 1.5% | 0% / 2.1% | 0% / 1.8% |
| vagn | 0% / 1.5% | 0% / 1.2% | 0% / 1.5% | 0% / 0.6% | 0% / 1.1% |
| ficklampa | 0% / 1.7% | 0% / 2.4% | 0% / 2.7% | 0% / 2.0% | 0% / 1.9% |

### Start weapon: telefon (Laddad telefon)

Policy `rush:telefon`, nattvandraren, N=500 per depth, base seed 1000.

| depth | quota | extraction rate | reached quota | time to quota (median) | fuel from kills | corr(kills/min, time to quota) | time to extract (median) | end time median (p10-p90) | median final level | peak enemies (median / max) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 92 | 6.8% | 7.8% | 3:47 | 62% | -0.63 | 4:00 | 2:47 (2:12-3:47) | 7 | 157 / 180 |
| 2 | 100 | 0.6% | 0.8% | 3:36 | 65% | -0.38 | 3:36 | 2:16 (1:50-2:54) | 6 | 162 / 180 |
| 3 | 108 | 0% | 0% | n/a | n/a | n/a | n/a | 1:53 (1:30-2:22) | 5 | 164 / 180 |
| 4 | 116 | 0% | 0% | n/a | n/a | n/a | n/a | 1:34 (1:14-1:57) | 4 | 151 / 180 |
| 5 | 124 | 0% | 0% | n/a | n/a | n/a | n/a | 1:19 (1:01-1:37) | 4 | 141 / 180 |

Evolved % of all runs / damage share, per weapon:

| weapon | depth 1 | depth 2 | depth 3 | depth 4 | depth 5 |
|---|---|---|---|---|---|
| nyckel | 0% / 1.8% | 0% / 2.0% | 0% / 3.1% | 0% / 4.6% | 0% / 3.1% |
| korv | 0% / 6.4% | 0% / 2.9% | 0% / 3.1% | 0% / 3.2% | 0% / 2.2% |
| telefon (start) | 0% / 84% | 0% / 86% | 0% / 85% | 0% / 86% | 0% / 87% |
| spray | 0% / 2.8% | 0% / 2.5% | 0% / 1.6% | 0% / 2.3% | 0% / 4.8% |
| vagn | 0% / 1.7% | 0% / 1.4% | 0% / 2.0% | 0% / 0.9% | 0% / 0.5% |
| ficklampa | 0% / 3.4% | 0% / 5.3% | 0% / 5.1% | 0% / 2.7% | 0% / 2.6% |

### Start weapon: spray (Sprayburk)

Policy `rush:spray`, nattvandraren, N=500 per depth, base seed 1000.

| depth | quota | extraction rate | reached quota | time to quota (median) | fuel from kills | corr(kills/min, time to quota) | time to extract (median) | end time median (p10-p90) | median final level | peak enemies (median / max) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 92 | 16% | 20% | 3:52 | 62% | -0.51 | 4:03 | 3:06 (2:21-4:06) | 9 | 130 / 180 |
| 2 | 100 | 4.6% | 5.2% | 4:02 | 70% | -0.57 | 4:06 | 2:33 (1:56-3:34) | 8 | 131 / 180 |
| 3 | 108 | 0.6% | 0.8% | 3:53 | 63% | -0.72 | 3:51 | 1:59 (1:24-2:45) | 7 | 118 / 180 |
| 4 | 116 | 0.2% | 0.2% | 3:59 | 66% | n/a | 4:05 | 1:37 (1:09-2:13) | 6 | 112 / 180 |
| 5 | 124 | 0% | 0% | n/a | n/a | n/a | n/a | 1:18 (0:59-1:51) | 5 | 99 / 180 |

Evolved % of all runs / damage share, per weapon:

| weapon | depth 1 | depth 2 | depth 3 | depth 4 | depth 5 |
|---|---|---|---|---|---|
| nyckel | 0% / 2.0% | 0% / 1.8% | 0% / 1.8% | 0% / 3.2% | 0% / 3.0% |
| korv | 0% / 3.0% | 0% / 3.5% | 0% / 2.5% | 0% / 2.3% | 0% / 1.5% |
| telefon | 0% / 1.8% | 0% / 1.5% | 0% / 1.4% | 0% / 0.9% | 0% / 0.9% |
| spray (start) | 0% / 89% | 0% / 88% | 0% / 91% | 0% / 90% | 0% / 93% |
| vagn | 0% / 1.7% | 0% / 1.9% | 0% / 1.1% | 0% / 1.9% | 0% / 0.8% |
| ficklampa | 0% / 2.8% | 0% / 2.9% | 0% / 2.3% | 0% / 1.7% | 0% / 0.9% |

### Start weapon: vagn (Kundvagn)

Policy `rush:vagn`, nattvandraren, N=500 per depth, base seed 1000.

| depth | quota | extraction rate | reached quota | time to quota (median) | fuel from kills | corr(kills/min, time to quota) | time to extract (median) | end time median (p10-p90) | median final level | peak enemies (median / max) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 92 | 4.8% | 5.6% | 3:50 | 67% | -0.39 | 4:07 | 2:52 (2:15-3:42) | 8 | 160 / 180 |
| 2 | 100 | 0.2% | 0.6% | 3:41 | 65% | 0.73 | 3:53 | 2:22 (1:54-2:54) | 7 | 161 / 180 |
| 3 | 108 | 0% | 0% | n/a | n/a | n/a | n/a | 1:58 (1:37-2:27) | 6 | 154 / 180 |
| 4 | 116 | 0% | 0% | n/a | n/a | n/a | n/a | 1:42 (1:26-2:06) | 5 | 157 / 180 |
| 5 | 124 | 0% | 0% | n/a | n/a | n/a | n/a | 1:26 (1:06-1:47) | 5 | 139 / 180 |

Evolved % of all runs / damage share, per weapon:

| weapon | depth 1 | depth 2 | depth 3 | depth 4 | depth 5 |
|---|---|---|---|---|---|
| nyckel | 0% / 1.7% | 0% / 2.5% | 0% / 3.0% | 0% / 2.2% | 0% / 4.0% |
| korv | 0% / 3.4% | 0% / 3.4% | 0% / 1.6% | 0% / 2.6% | 0% / 1.1% |
| telefon | 0% / 2.0% | 0% / 1.7% | 0% / 1.2% | 0% / 1.3% | 0% / 0.8% |
| spray | 0% / 2.5% | 0% / 1.7% | 0% / 1.8% | 0% / 3.4% | 0% / 1.0% |
| vagn (start) | 0% / 87% | 0% / 87% | 0% / 90% | 0% / 88% | 0% / 91% |
| ficklampa | 0% / 3.0% | 0% / 3.4% | 0% / 2.8% | 0% / 2.1% | 0% / 1.7% |

### Start weapon: ficklampa (Ficklampa)

Policy `rush:ficklampa`, nattvandraren, N=500 per depth, base seed 1000.

| depth | quota | extraction rate | reached quota | time to quota (median) | fuel from kills | corr(kills/min, time to quota) | time to extract (median) | end time median (p10-p90) | median final level | peak enemies (median / max) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 92 | 58% | 62% | 3:51 | 62% | -0.35 | 4:02 | 3:47 (2:51-4:27) | 11 | 121 / 180 |
| 2 | 100 | 25% | 30% | 3:54 | 70% | -0.48 | 4:08 | 3:10 (2:16-4:20) | 10 | 142 / 180 |
| 3 | 108 | 7.2% | 9.2% | 3:45 | 68% | -0.68 | 4:00 | 2:32 (1:51-3:44) | 8 | 152 / 180 |
| 4 | 116 | 1.4% | 1.4% | 3:48 | 70% | -0.37 | 3:53 | 2:03 (1:32-2:56) | 7 | 145 / 180 |
| 5 | 124 | 0% | 0% | n/a | n/a | n/a | n/a | 1:36 (1:11-2:12) | 6 | 131 / 180 |

Evolved % of all runs / damage share, per weapon:

| weapon | depth 1 | depth 2 | depth 3 | depth 4 | depth 5 |
|---|---|---|---|---|---|
| nyckel | 0% / 1.4% | 0% / 1.4% | 0% / 2.5% | 0% / 2.1% | 0% / 1.3% |
| korv | 0% / 3.0% | 0% / 2.0% | 0% / 1.1% | 0% / 2.2% | 0% / 1.6% |
| telefon | 0% / 0.8% | 0% / 0.9% | 0% / 0.7% | 0% / 0.7% | 0% / 0.8% |
| spray | 0% / 0.9% | 0% / 1.8% | 0% / 2.3% | 0% / 1.8% | 0% / 1.9% |
| vagn | 0% / 1.6% | 0% / 1.3% | 0% / 1.0% | 0% / 1.1% | 0% / 0.5% |
| ficklampa (start) | 0.8% / 92% | 0.4% / 93% | 0.2% / 92% | 0% / 92% | 0% / 94% |

