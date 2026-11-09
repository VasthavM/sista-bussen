# v2 balance baseline: weapon balance (ticket #14)

Build `totto/14-weapons` (on `totto/v2` @ `04c16e7`). Rush policy, `street` stop, nattvandraren, no meta mods, depth 1-5, N=500 per config, base seed 1000, quota `92 + 8 * (depth - 1)`. Raw data: `v2-baseline.json`. Every changed number and why: `weapons-v2.md`. The fuel/quota notes from #12 (where fuel comes from, why a depth-1 map takes about 3:45) are in git history (`totto/12-sim`) and still hold, because #14 does not touch fuel, spawns or enemies.

Regenerate: `node tools/balance.mjs --depths 1-5 --weapons all --n 500 --out specs/balance/v2-baseline.json --md specs/balance/tables.md --layout baseline`. Add `--unlock all` for the early-evolution runs.

## Before and after, extraction rate per starting weapon

"Before" is the #12 baseline (`totto/12-sim`), same seeds. N=500 each.

| start weapon | depth 1 | depth 2 | depth 3 | depth 4 | depth 5 |
|---|---|---|---|---|---|
| nyckel | 36% -> 45% | 11% -> 16% | 4.6% -> 8.0% | 0% -> 1.4% | 0% -> 0.2% |
| korv | 25% -> 44% | 4.2% -> 8.6% | 0.2% -> 1.6% | 0% -> 0% | 0% -> 0% |
| telefon | 6.8% -> 44% | 0.6% -> 10% | 0% -> 1.2% | 0% -> 0% | 0% -> 0% |
| spray | 16% -> 46% | 4.6% -> 15% | 0.6% -> 3.6% | 0.2% -> 0% | 0% -> 0% |
| vagn | 4.8% -> 45% | 0.2% -> 6.8% | 0% -> 1.0% | 0% -> 0.2% | 0% -> 0% |
| ficklampa | 58% -> 46% | 25% -> 18% | 7.2% -> 5.4% | 1.4% -> 0.6% | 0% -> 0.2% |

Depth 1 now spans 44% to 46% (2.6 points; the AC allows 30-50% and a 15 point gap). Depth 4 and 5 are close to zero for every weapon by design; depth 3 is the lowest depth with a real chance.

## Depth curve, N=300 (AC: no weapon at 0% before depth 4)

| start weapon | depth 2 | depth 3 | depth 4 | depth 5 |
|---|---|---|---|---|
| nyckel | 17% | 8.3% | 1.0% | 0.3% |
| korv | 10% | 1.7% | 0% | 0% |
| telefon | 10% | 0.7% | 0% | 0% |
| spray | 13% | 4.3% | 0% | 0% |
| vagn | 7.3% | 0.7% | 0.3% | 0% |
| ficklampa | 17% | 6.0% | 1.0% | 0.3% |

Telefon and vagn at depth 3 are 2 extractions in 300. They are deterministic (same seeds, same result) but thin; a future depth-band pass (v2-8) should widen them.

## Early evolution unlock, depth 1, N=500 (`--unlock all`)

Weapon level 5 and passive level 2 instead of 8 and 3. "Evolved" = share of extracted runs in which the starting weapon had evolved (AC target: at least 35%). Without the unlock the same measure is 0% to 0.4%.

| start weapon | extraction, no unlock | extraction, unlock | starting weapon evolved (of extracted), unlock | same, no unlock |
|---|---|---|---|---|
| nyckel | 45% | 56% | 55% | 0% |
| korv | 44% | 56% | 59% | 0% |
| telefon | 44% | 69% | 57% | 0.4% |
| spray | 46% | 46% | 54% | 0.4% |
| vagn | 45% | 62% | 55% | 0% |
| ficklampa | 46% | 62% | 68% | 0.4% |

## Baseline tables, no unlock

### Start weapon: nyckel (Nyckel)

Policy `rush:nyckel`, nattvandraren, N=500 per depth, base seed 1000.

| depth | quota | extraction rate | reached quota | time to quota (median) | fuel from kills | corr(kills/min, time to quota) | time to extract (median) | end time median (p10-p90) | median final level | peak enemies (median / max) | start evolved (of extracted) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 92 | 45% | 59% | 3:41 | 63% | -0.42 | 3:52 | 3:37 (2:50-4:18) | 11 | 156 / 180 | 0% |
| 2 | 100 | 16% | 25% | 3:37 | 65% | -0.54 | 3:50 | 3:00 (2:23-3:58) | 10 | 154 / 180 | 0% |
| 3 | 108 | 8.0% | 14% | 3:27 | 63% | -0.54 | 3:43 | 2:38 (2:05-3:36) | 9 | 160 / 180 | 0% |
| 4 | 116 | 1.4% | 1.8% | 3:19 | 66% | -0.62 | 3:17 | 2:15 (1:50-2:53) | 8 | 148 / 180 | 0% |
| 5 | 124 | 0.2% | 1.2% | 3:16 | 64% | -0.46 | 3:38 | 2:03 (1:40-2:33) | 8 | 150 / 180 | 0% |

Evolved % of all runs / damage share, per weapon:

| weapon | depth 1 | depth 2 | depth 3 | depth 4 | depth 5 |
|---|---|---|---|---|---|
| nyckel (start) | 0% / 90% | 0% / 91% | 0% / 91% | 0% / 91% | 0% / 92% |
| korv | 0% / 2.2% | 0% / 2.3% | 0% / 1.7% | 0% / 2.4% | 0% / 2.1% |
| telefon | 0% / 2.2% | 0% / 1.5% | 0% / 1.0% | 0% / 1.4% | 0% / 0.8% |
| spray | 0% / 1.6% | 0% / 1.7% | 0% / 2.8% | 0% / 2.8% | 0% / 2.9% |
| vagn | 0% / 2.4% | 0% / 2.5% | 0% / 2.5% | 0% / 2.1% | 0% / 1.7% |
| ficklampa | 0% / 2.1% | 0% / 1.2% | 0% / 1.2% | 0% / 0.7% | 0% / 0.8% |

### Start weapon: korv (Grillkorv)

Policy `rush:korv`, nattvandraren, N=500 per depth, base seed 1000.

| depth | quota | extraction rate | reached quota | time to quota (median) | fuel from kills | corr(kills/min, time to quota) | time to extract (median) | end time median (p10-p90) | median final level | peak enemies (median / max) | start evolved (of extracted) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 92 | 44% | 47% | 3:41 | 62% | -0.69 | 3:49 | 3:35 (2:47-4:19) | 11 | 125 / 180 | 0% |
| 2 | 100 | 8.6% | 11% | 3:33 | 66% | -0.71 | 3:44 | 2:45 (2:10-3:38) | 8 | 146 / 180 | 0% |
| 3 | 108 | 1.6% | 2.6% | 3:33 | 68% | -0.5 | 3:59 | 2:13 (1:38-2:59) | 7 | 146 / 180 | 0% |
| 4 | 116 | 0% | 0.2% | 3:32 | 70% | n/a | n/a | 1:50 (1:20-2:31) | 6 | 140 / 180 | n/a |
| 5 | 124 | 0% | 0% | n/a | n/a | n/a | n/a | 1:29 (1:03-1:59) | 5 | 126 / 180 | n/a |

Evolved % of all runs / damage share, per weapon:

| weapon | depth 1 | depth 2 | depth 3 | depth 4 | depth 5 |
|---|---|---|---|---|---|
| nyckel | 0% / 0.7% | 0% / 1.9% | 0% / 3.1% | 0% / 2.1% | 0% / 2.2% |
| korv (start) | 0% / 93% | 0% / 91% | 0% / 88% | 0% / 89% | 0% / 89% |
| telefon | 0% / 1.4% | 0% / 1.9% | 0% / 2.2% | 0% / 1.8% | 0% / 1.0% |
| spray | 0% / 1.2% | 0% / 1.8% | 0% / 2.3% | 0% / 2.8% | 0% / 3.8% |
| vagn | 0% / 2.6% | 0% / 1.7% | 0% / 2.5% | 0% / 2.9% | 0% / 2.2% |
| ficklampa | 0% / 0.8% | 0% / 1.9% | 0% / 1.8% | 0% / 1.5% | 0% / 1.6% |

### Start weapon: telefon (Laddad telefon)

Policy `rush:telefon`, nattvandraren, N=500 per depth, base seed 1000.

| depth | quota | extraction rate | reached quota | time to quota (median) | fuel from kills | corr(kills/min, time to quota) | time to extract (median) | end time median (p10-p90) | median final level | peak enemies (median / max) | start evolved (of extracted) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 92 | 44% | 52% | 3:32 | 62% | -0.51 | 3:40 | 3:30 (2:46-4:07) | 11 | 98 / 180 | 0.4% |
| 2 | 100 | 10% | 14% | 3:27 | 65% | -0.61 | 3:35 | 2:52 (2:11-3:38) | 9 | 124 / 180 | 3.9% |
| 3 | 108 | 1.2% | 1.8% | 3:24 | 68% | -0.57 | 3:36 | 2:26 (1:53-3:01) | 8 | 145 / 180 | 0% |
| 4 | 116 | 0% | 0% | n/a | n/a | n/a | n/a | 1:58 (1:36-2:34) | 7 | 152 / 180 | n/a |
| 5 | 124 | 0% | 0% | n/a | n/a | n/a | n/a | 1:39 (1:17-2:06) | 6 | 147 / 180 | n/a |

Evolved % of all runs / damage share, per weapon:

| weapon | depth 1 | depth 2 | depth 3 | depth 4 | depth 5 |
|---|---|---|---|---|---|
| nyckel | 0% / 1.0% | 0% / 1.7% | 0% / 2.2% | 0% / 2.5% | 0% / 1.5% |
| korv | 0% / 0.7% | 0% / 2.2% | 0% / 2.3% | 0% / 2.5% | 0% / 1.4% |
| telefon (start) | 0.2% / 93% | 0.4% / 89% | 0% / 88% | 0% / 90% | 0% / 91% |
| spray | 0% / 1.5% | 0% / 1.4% | 0% / 2.6% | 0% / 1.8% | 0% / 2.1% |
| vagn | 0% / 2.2% | 0% / 4.7% | 0% / 3.2% | 0% / 2.4% | 0% / 2.1% |
| ficklampa | 0% / 1.4% | 0% / 1.2% | 0% / 1.6% | 0% / 1.2% | 0% / 1.6% |

### Start weapon: spray (Sprayburk)

Policy `rush:spray`, nattvandraren, N=500 per depth, base seed 1000.

| depth | quota | extraction rate | reached quota | time to quota (median) | fuel from kills | corr(kills/min, time to quota) | time to extract (median) | end time median (p10-p90) | median final level | peak enemies (median / max) | start evolved (of extracted) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 92 | 46% | 52% | 3:33 | 64% | -0.37 | 3:43 | 3:27 (2:37-4:07) | 11 | 99 / 180 | 0.4% |
| 2 | 100 | 15% | 18% | 3:33 | 65% | -0.36 | 3:45 | 2:49 (2:11-3:45) | 9 | 110 / 180 | 0% |
| 3 | 108 | 3.6% | 5.0% | 3:20 | 63% | -0.33 | 3:29 | 2:19 (1:40-3:10) | 8 | 111 / 180 | 0% |
| 4 | 116 | 0% | 0% | n/a | n/a | n/a | n/a | 1:56 (1:26-2:37) | 7 | 114 / 180 | n/a |
| 5 | 124 | 0% | 0% | n/a | n/a | n/a | n/a | 1:35 (1:07-2:11) | 6 | 103 / 180 | n/a |

Evolved % of all runs / damage share, per weapon:

| weapon | depth 1 | depth 2 | depth 3 | depth 4 | depth 5 |
|---|---|---|---|---|---|
| nyckel | 0% / 1.4% | 0% / 1.8% | 0% / 1.7% | 0% / 0.9% | 0% / 2.3% |
| korv | 0% / 3.9% | 0% / 1.6% | 0% / 1.5% | 0% / 2.3% | 0% / 2.8% |
| telefon | 0% / 2.6% | 0% / 1.9% | 0% / 1.2% | 0% / 2.9% | 0% / 1.1% |
| spray (start) | 0.2% / 87% | 0% / 92% | 0% / 90% | 0% / 90% | 0% / 90% |
| vagn | 0% / 3.6% | 0% / 2.0% | 0% / 4.3% | 0% / 2.6% | 0% / 2.8% |
| ficklampa | 0% / 1.4% | 0% / 1.2% | 0% / 1.0% | 0% / 1.0% | 0% / 1.4% |

### Start weapon: vagn (Kundvagn)

Policy `rush:vagn`, nattvandraren, N=500 per depth, base seed 1000.

| depth | quota | extraction rate | reached quota | time to quota (median) | fuel from kills | corr(kills/min, time to quota) | time to extract (median) | end time median (p10-p90) | median final level | peak enemies (median / max) | start evolved (of extracted) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 92 | 45% | 54% | 3:40 | 67% | -0.57 | 3:49 | 3:35 (2:53-4:20) | 11 | 109 / 180 | 0% |
| 2 | 100 | 6.8% | 10% | 3:33 | 65% | -0.73 | 3:28 | 2:56 (2:23-3:42) | 9 | 134 / 180 | 0% |
| 3 | 108 | 1.0% | 2.0% | 3:29 | 68% | -0.38 | 3:40 | 2:32 (2:03-3:11) | 8 | 141 / 180 | 0% |
| 4 | 116 | 0.2% | 0.6% | 3:17 | 66% | -0.61 | 3:23 | 2:09 (1:47-2:37) | 8 | 146 / 180 | 0% |
| 5 | 124 | 0% | 0% | n/a | n/a | n/a | n/a | 1:52 (1:33-2:15) | 7 | 145 / 180 | n/a |

Evolved % of all runs / damage share, per weapon:

| weapon | depth 1 | depth 2 | depth 3 | depth 4 | depth 5 |
|---|---|---|---|---|---|
| nyckel | 0% / 0.8% | 0% / 0.9% | 0% / 1.2% | 0% / 1.7% | 0% / 2.0% |
| korv | 0% / 1.1% | 0% / 1.9% | 0% / 1.9% | 0% / 0.9% | 0% / 1.5% |
| telefon | 0% / 1.5% | 0% / 2.2% | 0% / 2.3% | 0% / 2.0% | 0% / 1.2% |
| spray | 0% / 1.3% | 0% / 1.3% | 0% / 2.0% | 0% / 2.5% | 0% / 2.1% |
| vagn (start) | 0% / 95% | 0% / 92% | 0% / 91% | 0% / 91% | 0% / 92% |
| ficklampa | 0% / 0.7% | 0% / 1.5% | 0% / 1.2% | 0% / 1.5% | 0% / 1.4% |

### Start weapon: ficklampa (Ficklampa)

Policy `rush:ficklampa`, nattvandraren, N=500 per depth, base seed 1000.

| depth | quota | extraction rate | reached quota | time to quota (median) | fuel from kills | corr(kills/min, time to quota) | time to extract (median) | end time median (p10-p90) | median final level | peak enemies (median / max) | start evolved (of extracted) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 92 | 46% | 49% | 3:59 | 62% | -0.52 | 4:08 | 3:43 (2:33-4:32) | 11 | 141 / 180 | 0.4% |
| 2 | 100 | 18% | 19% | 3:58 | 65% | -0.62 | 4:10 | 2:57 (2:09-4:14) | 9 | 155 / 180 | 1.1% |
| 3 | 108 | 5.4% | 6.4% | 4:03 | 68% | -0.74 | 4:15 | 2:21 (1:41-3:28) | 7 | 158 / 180 | 3.7% |
| 4 | 116 | 0.6% | 1.4% | 3:37 | 70% | -0.6 | 3:46 | 1:53 (1:24-2:38) | 6 | 141 / 180 | 0% |
| 5 | 124 | 0.2% | 0.2% | 4:12 | 64% | n/a | 4:15 | 1:26 (1:03-1:57) | 5 | 124 / 180 | 0% |

Evolved % of all runs / damage share, per weapon:

| weapon | depth 1 | depth 2 | depth 3 | depth 4 | depth 5 |
|---|---|---|---|---|---|
| nyckel | 0% / 1.3% | 0% / 1.4% | 0% / 3.1% | 0% / 3.7% | 0% / 2.2% |
| korv | 0% / 2.3% | 0% / 2.7% | 0% / 2.7% | 0% / 3.0% | 0% / 1.9% |
| telefon | 0% / 1.5% | 0% / 1.9% | 0% / 1.9% | 0% / 2.5% | 0% / 1.5% |
| spray | 0% / 2.0% | 0% / 2.0% | 0% / 2.1% | 0% / 2.5% | 0% / 3.2% |
| vagn | 0% / 4.6% | 0% / 4.3% | 0% / 3.5% | 0% / 2.8% | 0% / 1.8% |
| ficklampa (start) | 0.2% / 88% | 0.2% / 88% | 0.2% / 87% | 0% / 86% | 0% / 89% |

## Baseline table, depth 1, with `--unlock all`

### Start weapon: nyckel (Nyckel)

Policy `rush:nyckel`, nattvandraren, N=500 per depth, base seed 1000.

| depth | quota | extraction rate | reached quota | time to quota (median) | fuel from kills | corr(kills/min, time to quota) | time to extract (median) | end time median (p10-p90) | median final level | peak enemies (median / max) | start evolved (of extracted) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 92 | 56% | 61% | 3:38 | 67% | -0.46 | 3:47 | 3:34 (2:46-4:13) | 11 | 142 / 180 | 55% |

Evolved % of all runs / damage share, per weapon:

| weapon | depth 1 |
|---|---|
| nyckel (start) | 33% / 94% |
| korv | 0% / 1.0% |
| telefon | 0% / 1.5% |
| spray | 0% / 1.2% |
| vagn | 0% / 1.5% |
| ficklampa | 0% / 0.6% |

### Start weapon: korv (Grillkorv)

Policy `rush:korv`, nattvandraren, N=500 per depth, base seed 1000.

| depth | quota | extraction rate | reached quota | time to quota (median) | fuel from kills | corr(kills/min, time to quota) | time to extract (median) | end time median (p10-p90) | median final level | peak enemies (median / max) | start evolved (of extracted) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 92 | 56% | 60% | 3:27 | 67% | -0.36 | 3:35 | 3:26 (2:56-4:01) | 11 | 98 / 180 | 59% |

Evolved % of all runs / damage share, per weapon:

| weapon | depth 1 |
|---|---|
| nyckel | 0% / 0.3% |
| korv (start) | 35% / 97% |
| telefon | 0% / 0.5% |
| spray | 0% / 0.4% |
| vagn | 0% / 0.7% |
| ficklampa | 0% / 0.6% |

### Start weapon: telefon (Laddad telefon)

Policy `rush:telefon`, nattvandraren, N=500 per depth, base seed 1000.

| depth | quota | extraction rate | reached quota | time to quota (median) | fuel from kills | corr(kills/min, time to quota) | time to extract (median) | end time median (p10-p90) | median final level | peak enemies (median / max) | start evolved (of extracted) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 92 | 69% | 73% | 3:18 | 62% | -0.53 | 3:24 | 3:20 (2:54-3:53) | 11 | 65 / 180 | 57% |

Evolved % of all runs / damage share, per weapon:

| weapon | depth 1 |
|---|---|
| nyckel | 0% / 0.4% |
| korv | 0% / 0.7% |
| telefon (start) | 39% / 97% |
| spray | 0% / 0.4% |
| vagn | 0% / 1.2% |
| ficklampa | 0% / 0.5% |

### Start weapon: spray (Sprayburk)

Policy `rush:spray`, nattvandraren, N=500 per depth, base seed 1000.

| depth | quota | extraction rate | reached quota | time to quota (median) | fuel from kills | corr(kills/min, time to quota) | time to extract (median) | end time median (p10-p90) | median final level | peak enemies (median / max) | start evolved (of extracted) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 92 | 46% | 51% | 3:25 | 67% | -0.31 | 3:32 | 3:16 (2:35-3:53) | 11 | 91 / 180 | 54% |

Evolved % of all runs / damage share, per weapon:

| weapon | depth 1 |
|---|---|
| nyckel | 0% / 1.0% |
| korv | 0% / 2.2% |
| telefon | 0% / 1.6% |
| spray (start) | 26% / 92% |
| vagn | 0% / 2.2% |
| ficklampa | 0% / 1.3% |

### Start weapon: vagn (Kundvagn)

Policy `rush:vagn`, nattvandraren, N=500 per depth, base seed 1000.

| depth | quota | extraction rate | reached quota | time to quota (median) | fuel from kills | corr(kills/min, time to quota) | time to extract (median) | end time median (p10-p90) | median final level | peak enemies (median / max) | start evolved (of extracted) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 92 | 62% | 66% | 3:25 | 62% | -0.58 | 3:30 | 3:27 (2:56-4:06) | 11 | 93 / 180 | 55% |

Evolved % of all runs / damage share, per weapon:

| weapon | depth 1 |
|---|---|
| nyckel | 0% / 0.3% |
| korv | 0% / 1.0% |
| telefon | 0% / 0.7% |
| spray | 0% / 0.4% |
| vagn (start) | 35% / 97% |
| ficklampa | 0% / 0.4% |

### Start weapon: ficklampa (Ficklampa)

Policy `rush:ficklampa`, nattvandraren, N=500 per depth, base seed 1000.

| depth | quota | extraction rate | reached quota | time to quota (median) | fuel from kills | corr(kills/min, time to quota) | time to extract (median) | end time median (p10-p90) | median final level | peak enemies (median / max) | start evolved (of extracted) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 92 | 62% | 63% | 3:38 | 63% | -0.47 | 3:45 | 3:32 (2:41-4:18) | 11 | 131 / 180 | 68% |

Evolved % of all runs / damage share, per weapon:

| weapon | depth 1 |
|---|---|
| nyckel | 0% / 1.1% |
| korv | 0% / 0.8% |
| telefon | 0% / 1.5% |
| spray | 0% / 1.1% |
| vagn | 0% / 1.3% |
| ficklampa (start) | 42% / 94% |
