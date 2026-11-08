# v2 balance baseline: fuel quota + bus extraction (ticket #12)

Build `totto/12-sim`. Replaces the 03:00 win with "meet the fuel quota, then touch the bus". Measures only; no combat number was changed. Compare with the night baseline in `baseline.md` (build `totto/phase1`). Raw data: `v2-baseline.json`.

## Quota formula

`fuelQuotaFor(depth) = 50 + 5 * (depth - 1)` fuel (`src/sim/objective.ts`). Street stop, no multipliers.

What the quota is measured against:

- Canisters carry 1.4 x the quota in total (`ceil(1.4 * quota / 5) + 0..2` canisters of 5 fuel, so 14-16 at depth 1). The supply is always there.
- Canisters are **released over time**: canister `i` of `n` appears at `6 + 420 * (i + jitter) / n` seconds, seeded. This is what holds a map at roughly four minutes. In an early trial with every canister on the map from the start (quota 30) all six weapons extracted 100% of runs at about 0:16, so the objective alone did not create any pressure.
- Zombies drop 1 fuel with a 2.5% chance per kill (own RNG stream, so combat rolls are untouched). This is the only fuel source that scales with how well a build kills.

Knobs, in the order I would turn them: `quota` (shifts every weapon), `CANISTER_SPAN` (shifts all weapons by the same time), `FUEL_DROP_CHANCE` (favours weapons that kill fast). Tuned on depth 1, N=500, seed 1000, same seeds as the night baseline.

## Depth 1 extraction rate against the old night 1 win rate (rush policy, N=500)

| start weapon | old night 1 win rate | new depth 1 extraction rate | difference (points) |
|---|---|---|---|
| nyckel | 32% | 30.0% | -2.0 |
| korv | 28% | 28.0% | 0.0 |
| telefon | 5.8% | 3.6% | -2.2 |
| spray | 15% | 20.0% | +5.0 |
| vagn | 3.8% | 5.6% | +1.8 |
| ficklampa | 50% | 53.0% | +3.0 |

All six are inside the +-10 point band; the worst is spray at +5.0. Median time to extract is 3:59-4:09 for every weapon (old: win at 4:00 flat), so the bot is playing the same four minutes as before and the survival odds carry over.

## What changed for the bot **[measured setup]**

- Same kiting bot as the night baseline (orbit + enemy and shot avoidance). While the quota is open it leans toward the nearest released canister (orbit weight 0.3, goal pull 1.2); once met it leans toward the bus. `botInput` in `tools/balance-lib.ts`.
- No fixed-time bosses on a street stop (they are `stop: 'boss'` only now), so late survival is a little better than the night baseline for the same weapon. That is part of what the quota absorbs.
- Hard stop at 900 s counts as not extracted. It is a safety net: the largest p90 end time in this table is 4:26.
- "Reached quota" = share of runs that met the quota (some then die on the way to the bus). Time to quota and time to extract are medians over the runs that got there.

## Baseline: rush policy, depth 1-5, N=500 per config

### Start weapon: nyckel (Nyckel)

Policy `rush:nyckel`, nattvandraren, N=500 per depth, base seed 1000.

| depth | quota | extraction rate | reached quota | time to quota (median) | time to extract (median) | end time median (p10-p90) | median final level | peak enemies (median / max) |
|---|---|---|---|---|---|---|---|---|
| 1 | 50 | 30% | 35% | 3:56 | 4:08 | 3:33 (2:35-4:22) | 10 | 152 / 180 |
| 2 | 55 | 9.6% | 10% | 3:52 | 4:03 | 2:55 (2:13-3:52) | 9 | 166 / 180 |
| 3 | 60 | 4.2% | 6.0% | 4:06 | 4:11 | 2:35 (1:59-3:39) | 9 | 165 / 180 |
| 4 | 65 | 0.4% | 0.4% | 4:15 | 4:23 | 2:13 (1:46-2:55) | 8 | 162 / 180 |
| 5 | 70 | 0.2% | 0.2% | 4:07 | 4:10 | 2:01 (1:37-2:32) | 8 | 163 / 180 |

Evolved % of all runs / damage share, per weapon:

| weapon | depth 1 | depth 2 | depth 3 | depth 4 | depth 5 |
|---|---|---|---|---|---|
| nyckel (start) | 0% / 91% | 0% / 91% | 0% / 90% | 0% / 94% | 0% / 94% |
| korv | 0% / 2.2% | 0% / 1.1% | 0% / 1.9% | 0% / 1.3% | 0% / 0.8% |
| telefon | 0% / 0.9% | 0% / 0.8% | 0% / 0.8% | 0% / 0.7% | 0% / 0.6% |
| spray | 0% / 1.7% | 0% / 1.6% | 0% / 3.0% | 0% / 1.8% | 0% / 1.6% |
| vagn | 0% / 1.7% | 0% / 1.2% | 0% / 1.3% | 0% / 1.0% | 0% / 0.7% |
| ficklampa | 0% / 2.9% | 0% / 4.2% | 0% / 3.1% | 0% / 1.3% | 0% / 2.6% |

### Start weapon: korv (Grillkorv)

Policy `rush:korv`, nattvandraren, N=500 per depth, base seed 1000.

| depth | quota | extraction rate | reached quota | time to quota (median) | time to extract (median) | end time median (p10-p90) | median final level | peak enemies (median / max) |
|---|---|---|---|---|---|---|---|---|
| 1 | 50 | 28% | 32% | 4:00 | 4:09 | 3:30 (2:34-4:23) | 10 | 120 / 180 |
| 2 | 55 | 5.4% | 7.2% | 3:56 | 4:02 | 2:46 (2:07-3:43) | 8 | 146 / 180 |
| 3 | 60 | 0.6% | 0.6% | 3:41 | 3:49 | 2:08 (1:29-2:52) | 7 | 143 / 180 |
| 4 | 65 | 0% | 0.2% | 3:39 | n/a | 1:46 (1:15-2:22) | 6 | 141 / 180 |
| 5 | 70 | 0% | 0% | n/a | n/a | 1:30 (1:03-2:03) | 5 | 126 / 180 |

Evolved % of all runs / damage share, per weapon:

| weapon | depth 1 | depth 2 | depth 3 | depth 4 | depth 5 |
|---|---|---|---|---|---|
| nyckel | 0% / 1.1% | 0% / 2.1% | 0% / 1.4% | 0% / 1.7% | 0% / 2.9% |
| korv (start) | 0.2% / 94% | 0% / 91% | 0% / 91% | 0% / 89% | 0% / 88% |
| telefon | 0% / 1.2% | 0% / 1.1% | 0% / 1.0% | 0% / 1.1% | 0% / 0.7% |
| spray | 0% / 1.0% | 0% / 1.9% | 0% / 2.3% | 0% / 1.6% | 0% / 3.4% |
| vagn | 0% / 1.0% | 0% / 1.2% | 0% / 1.2% | 0% / 1.8% | 0% / 1.6% |
| ficklampa | 0% / 1.6% | 0% / 2.2% | 0% / 3.4% | 0% / 4.6% | 0% / 3.0% |

### Start weapon: telefon (Laddad telefon)

Policy `rush:telefon`, nattvandraren, N=500 per depth, base seed 1000.

| depth | quota | extraction rate | reached quota | time to quota (median) | time to extract (median) | end time median (p10-p90) | median final level | peak enemies (median / max) |
|---|---|---|---|---|---|---|---|---|
| 1 | 50 | 3.6% | 4.2% | 3:57 | 4:07 | 2:47 (2:13-3:36) | 7 | 154 / 180 |
| 2 | 55 | 1.6% | 1.6% | 3:52 | 4:01 | 2:16 (1:49-3:00) | 6 | 161 / 180 |
| 3 | 60 | 0.2% | 0.2% | 3:41 | 3:53 | 1:56 (1:32-2:31) | 5 | 166 / 180 |
| 4 | 65 | 0% | 0% | n/a | n/a | 1:36 (1:14-2:04) | 4 | 155 / 180 |
| 5 | 70 | 0% | 0% | n/a | n/a | 1:20 (1:01-1:43) | 4 | 144 / 180 |

Evolved % of all runs / damage share, per weapon:

| weapon | depth 1 | depth 2 | depth 3 | depth 4 | depth 5 |
|---|---|---|---|---|---|
| nyckel | 0% / 1.5% | 0% / 2.8% | 0% / 5.5% | 0% / 3.2% | 0% / 4.2% |
| korv | 0% / 3.6% | 0% / 2.9% | 0% / 2.7% | 0% / 2.5% | 0% / 1.9% |
| telefon (start) | 0% / 87% | 0% / 83% | 0% / 82% | 0% / 84% | 0% / 85% |
| spray | 0% / 2.6% | 0% / 3.0% | 0% / 2.8% | 0% / 4.9% | 0% / 2.7% |
| vagn | 0% / 2.8% | 0% / 2.9% | 0% / 2.5% | 0% / 1.5% | 0% / 1.1% |
| ficklampa | 0% / 2.9% | 0% / 5.1% | 0% / 4.9% | 0% / 3.6% | 0% / 5.2% |

### Start weapon: spray (Sprayburk)

Policy `rush:spray`, nattvandraren, N=500 per depth, base seed 1000.

| depth | quota | extraction rate | reached quota | time to quota (median) | time to extract (median) | end time median (p10-p90) | median final level | peak enemies (median / max) |
|---|---|---|---|---|---|---|---|---|
| 1 | 50 | 20% | 23% | 3:54 | 4:05 | 3:04 (2:17-4:08) | 9 | 105 / 180 |
| 2 | 55 | 6.4% | 7.8% | 3:50 | 4:03 | 2:35 (1:54-3:40) | 8 | 111 / 180 |
| 3 | 60 | 0.6% | 1.0% | 4:17 | 4:29 | 2:00 (1:26-2:44) | 7 | 113 / 180 |
| 4 | 65 | 0% | 0% | n/a | n/a | 1:39 (1:10-2:19) | 6 | 111 / 180 |
| 5 | 70 | 0% | 0% | n/a | n/a | 1:20 (1:00-1:55) | 5 | 101 / 180 |

Evolved % of all runs / damage share, per weapon:

| weapon | depth 1 | depth 2 | depth 3 | depth 4 | depth 5 |
|---|---|---|---|---|---|
| nyckel | 0% / 1.9% | 0% / 2.0% | 0% / 1.5% | 0% / 2.8% | 0% / 1.4% |
| korv | 0% / 3.1% | 0% / 3.0% | 0% / 1.1% | 0% / 3.1% | 0% / 2.1% |
| telefon | 0% / 1.5% | 0% / 1.7% | 0% / 0.9% | 0% / 0.5% | 0% / 1.4% |
| spray (start) | 0.2% / 90% | 0% / 89% | 0% / 93% | 0% / 91% | 0% / 91% |
| vagn | 0% / 1.3% | 0% / 2.3% | 0% / 2.0% | 0% / 1.2% | 0% / 1.6% |
| ficklampa | 0% / 2.1% | 0% / 2.0% | 0% / 1.8% | 0% / 1.6% | 0% / 2.1% |

### Start weapon: vagn (Kundvagn)

Policy `rush:vagn`, nattvandraren, N=500 per depth, base seed 1000.

| depth | quota | extraction rate | reached quota | time to quota (median) | time to extract (median) | end time median (p10-p90) | median final level | peak enemies (median / max) |
|---|---|---|---|---|---|---|---|---|
| 1 | 50 | 5.6% | 8.2% | 3:54 | 3:59 | 2:52 (2:16-3:50) | 8 | 155 / 180 |
| 2 | 55 | 1.0% | 1.0% | 3:43 | 3:57 | 2:21 (1:54-3:01) | 7 | 157 / 180 |
| 3 | 60 | 0% | 0% | n/a | n/a | 2:02 (1:38-2:34) | 6 | 159 / 180 |
| 4 | 65 | 0% | 0% | n/a | n/a | 1:43 (1:26-2:09) | 5 | 163 / 180 |
| 5 | 70 | 0% | 0% | n/a | n/a | 1:29 (1:11-1:53) | 5 | 150 / 180 |

Evolved % of all runs / damage share, per weapon:

| weapon | depth 1 | depth 2 | depth 3 | depth 4 | depth 5 |
|---|---|---|---|---|---|
| nyckel | 0% / 1.8% | 0% / 3.1% | 0% / 2.5% | 0% / 2.6% | 0% / 2.4% |
| korv | 0% / 3.2% | 0% / 4.0% | 0% / 2.6% | 0% / 1.6% | 0% / 1.9% |
| telefon | 0% / 1.7% | 0% / 1.7% | 0% / 1.7% | 0% / 0.9% | 0% / 0.7% |
| spray | 0% / 3.9% | 0% / 2.4% | 0% / 3.1% | 0% / 3.1% | 0% / 2.4% |
| vagn (start) | 0% / 86% | 0% / 85% | 0% / 86% | 0% / 91% | 0% / 91% |
| ficklampa | 0% / 3.0% | 0% / 4.0% | 0% / 4.3% | 0% / 1.2% | 0% / 2.0% |

### Start weapon: ficklampa (Ficklampa)

Policy `rush:ficklampa`, nattvandraren, N=500 per depth, base seed 1000.

| depth | quota | extraction rate | reached quota | time to quota (median) | time to extract (median) | end time median (p10-p90) | median final level | peak enemies (median / max) |
|---|---|---|---|---|---|---|---|---|
| 1 | 50 | 53% | 56% | 3:56 | 4:06 | 3:49 (2:41-4:26) | 11 | 104 / 180 |
| 2 | 55 | 37% | 39% | 3:57 | 4:08 | 3:23 (2:20-4:22) | 11 | 127 / 180 |
| 3 | 60 | 16% | 18% | 4:02 | 4:14 | 2:42 (1:53-4:12) | 9 | 144 / 180 |
| 4 | 65 | 4.8% | 5.6% | 4:06 | 4:23 | 2:09 (1:35-3:22) | 7 | 146 / 180 |
| 5 | 70 | 0% | 0% | n/a | n/a | 1:46 (1:13-2:34) | 6 | 144 / 180 |

Evolved % of all runs / damage share, per weapon:

| weapon | depth 1 | depth 2 | depth 3 | depth 4 | depth 5 |
|---|---|---|---|---|---|
| nyckel | 0% / 1.3% | 0% / 1.0% | 0% / 1.6% | 0% / 1.8% | 0% / 1.4% |
| korv | 0% / 2.2% | 0% / 2.5% | 0% / 1.0% | 0% / 1.9% | 0% / 1.5% |
| telefon | 0% / 1.4% | 0% / 1.0% | 0% / 0.9% | 0% / 0.7% | 0% / 0.5% |
| spray | 0% / 1.4% | 0% / 1.4% | 0% / 1.6% | 0% / 1.7% | 0% / 1.2% |
| vagn | 0% / 2.1% | 0% / 1.1% | 0% / 1.5% | 0% / 1.1% | 0% / 1.5% |
| ficklampa (start) | 0.2% / 92% | 1.6% / 93% | 1.0% / 93% | 0.8% / 93% | 0% / 94% |

