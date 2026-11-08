# Balance baseline, build `totto/phase1` (c6d1da9) + harness

Ticket: GitHub issue #11. Measures only, no balance number was changed. Tags: **[measured]** is a number straight from the runs below, **[interpretation]** is my reading of it.

## What stands out

1. **[measured]** Evolutions almost never happen. Evolution rate is 0% in 27 of 30 rush configs (N=500 each) and 0.4% (2 of 500 runs) in the three Ficklampa night 1-3 configs. Greedy policy: 0% in all 30. Even with the starting weapon pre-levelled to 4 it tops out at 14%.
2. **[measured]** Two starters are close to dead. Night 1 win rate: Kundvagn 3.8% and Laddad telefon 5.8%, against Ficklampa 50%, Nyckel 32%, Grillkorv 28%, Sprayburk 15%. In mixed builds (greedy, Appendix A) Laddad telefon also has the lowest average damage share, 7.9% as a non-starter against 9-15% for the rest.
3. **[measured]** Ficklampa is the runaway starter. Best on every night (50% / 24% / 7.8% / 3.4% / 0.2%) and the only starter above 1% at night 4. In mixed builds Grillkorv leads damage (15.0% as non-starter, 55% night 1 win with it as starter) with Ficklampa second (13.8%).
4. **[measured]** The win rate falls off a cliff between night 1 and night 2, 2x to 19x depending on the starter (Ficklampa 50% to 24%, Nyckel 32% to 10%, Grillkorv 28% to 4.2%). Night 3 is under 8% for every starter, nights 4 and 5 are about 0%.
5. **[interpretation]** The kiting bot cannot reroll and probably plays worse than a good human (I am guessing), so absolute rates are a floor. The ordering between weapons and the shape of the cliff are the signal. With ~11 level-ups per night, evolution (weapon level 8 plus its passive at 3 = 10 specific picks out of 3-card offers) looks structurally out of reach, not unlucky.

## How it was measured **[measured]**

- Command: `node tools/balance.mjs --nights 1-5 --weapons all --n 500 --policy rush --out specs/balance/baseline.json --md ...`
- Character Nattvandraren, no meta upgrades, base seed 1000, run `i` uses seed 1000 + i. Same seeds for every weapon and night.
- Bot: kiting input ported from `tests/run.test.ts` (circles the arena, pushed off enemies within 150px, sidesteps shots). No rerolls, no revives. It plays every night the same way.
- Policy `rush:<starting weapon>`: take the evolution if offered, then the weapon, then its evolution passive, and avoid opening other weapon slots. This is the "I am building this weapon's evolution" player.
- Win = alive at 03:00. Time of death counts a win as 4:00 (240 s), so p90 = 4:00 means at least 10% of runs survived. Percentiles are nearest-rank.
- Level at 03:00 is the median level among runs that reached 03:00 (n shown). Median final level covers all runs.
- Evolved % = share of all runs where that weapon evolved at any point. Damage share = pooled raw damage dealt (overkill included) split by weapon, evolved forms count under the base weapon. Per-weapon split is attributed by the harness without touching `src/sim` (see `tools/balance-lib.ts` `attachAttribution`); the test checks it does not change the run and never books damage to an unowned weapon.
- Runtime: 30 configs x 500 nights = 15 000 nights in **76 s** wall on 16 worker threads (Mac with 18 cores), about 1 120 s of CPU. The N=200 runs below took 33-35 s each. Single-threaded it is about 80 ms per night, so N=200 on one core would be ~8 min; use the workers.
- Because the damage split in the rush tables is ~90% starter by construction, read the rush damage columns as "the policy did what it was told". The greedy appendix is where weapon-vs-weapon damage share means something.

## Baseline: rush policy, N=500 per config

### Start weapon: nyckel (Nyckel)

Policy `rush:nyckel`, nattvandraren, N=500 per night, base seed 1000.

| night | win rate | death time median (p10-p90) | level at 03:00 | median final level | peak enemies (median / max) |
|---|---|---|---|---|---|
| 1 | 32% | 3:37 (2:42-4:00) | 11 (n=158) | 10 | 165 / 180 |
| 2 | 10% | 2:55 (2:12-4:00) | 12 (n=52) | 9 | 163 / 180 |
| 3 | 3.4% | 2:35 (2:01-3:28) | 12 (n=17) | 9 | 167 / 180 |
| 4 | 0.2% | 2:11 (1:47-2:43) | 12 (n=1) | 8 | 153 / 180 |
| 5 | 0% | 1:58 (1:35-2:28) | n/a | 8 | 151 / 180 |

Evolved % of all runs / damage share, per weapon:

| weapon | night 1 | night 2 | night 3 | night 4 | night 5 |
|---|---|---|---|---|---|
| nyckel (start) | 0% / 91% | 0% / 92% | 0% / 92% | 0% / 93% | 0% / 95% |
| korv | 0% / 2.1% | 0% / 2.2% | 0% / 1.8% | 0% / 0.9% | 0% / 1.8% |
| telefon | 0% / 1.1% | 0% / 1.0% | 0% / 1.0% | 0% / 0.2% | 0% / 0.6% |
| spray | 0% / 1.3% | 0% / 1.5% | 0% / 1.9% | 0% / 1.9% | 0% / 1.4% |
| vagn | 0% / 1.6% | 0% / 1.3% | 0% / 1.0% | 0% / 0.9% | 0% / 0.5% |
| ficklampa | 0% / 2.4% | 0% / 1.9% | 0% / 1.8% | 0% / 2.6% | 0% / 1.1% |

### Start weapon: korv (Grillkorv)

Policy `rush:korv`, nattvandraren, N=500 per night, base seed 1000.

| night | win rate | death time median (p10-p90) | level at 03:00 | median final level | peak enemies (median / max) |
|---|---|---|---|---|---|
| 1 | 28% | 3:30 (2:39-4:00) | 11 (n=139) | 10 | 145 / 180 |
| 2 | 4.2% | 2:42 (2:08-3:34) | 12 (n=21) | 8 | 153 / 180 |
| 3 | 0.2% | 2:05 (1:30-2:43) | 11 (n=1) | 7 | 145 / 180 |
| 4 | 0% | 1:41 (1:17-2:14) | n/a | 6 | 135 / 180 |
| 5 | 0% | 1:27 (1:01-1:54) | n/a | 5 | 127 / 180 |

Evolved % of all runs / damage share, per weapon:

| weapon | night 1 | night 2 | night 3 | night 4 | night 5 |
|---|---|---|---|---|---|
| nyckel | 0% / 1.0% | 0% / 1.7% | 0% / 2.1% | 0% / 1.2% | 0% / 3.1% |
| korv (start) | 0% / 94% | 0% / 92% | 0% / 92% | 0% / 92% | 0% / 90% |
| telefon | 0% / 0.8% | 0% / 0.9% | 0% / 0.8% | 0% / 1.1% | 0% / 0.5% |
| spray | 0% / 1.2% | 0% / 2.0% | 0% / 1.3% | 0% / 1.8% | 0% / 2.4% |
| vagn | 0% / 1.3% | 0% / 0.9% | 0% / 1.4% | 0% / 1.5% | 0% / 1.4% |
| ficklampa | 0% / 1.9% | 0% / 2.4% | 0% / 2.0% | 0% / 2.3% | 0% / 2.2% |

### Start weapon: telefon (Laddad telefon)

Policy `rush:telefon`, nattvandraren, N=500 per night, base seed 1000.

| night | win rate | death time median (p10-p90) | level at 03:00 | median final level | peak enemies (median / max) |
|---|---|---|---|---|---|
| 1 | 5.8% | 2:47 (2:12-3:48) | 11 (n=29) | 7 | 159 / 180 |
| 2 | 0.6% | 2:16 (1:51-2:51) | 11 (n=3) | 6 | 168 / 180 |
| 3 | 0% | 1:52 (1:31-2:23) | n/a | 5 | 165 / 180 |
| 4 | 0% | 1:35 (1:17-1:56) | n/a | 4 | 156 / 180 |
| 5 | 0% | 1:19 (1:02-1:42) | n/a | 4 | 141 / 180 |

Evolved % of all runs / damage share, per weapon:

| weapon | night 1 | night 2 | night 3 | night 4 | night 5 |
|---|---|---|---|---|---|
| nyckel | 0% / 2.3% | 0% / 3.1% | 0% / 4.5% | 0% / 3.6% | 0% / 5.2% |
| korv | 0% / 2.4% | 0% / 3.2% | 0% / 1.8% | 0% / 1.7% | 0% / 1.5% |
| telefon (start) | 0% / 85% | 0% / 85% | 0% / 84% | 0% / 86% | 0% / 84% |
| spray | 0% / 3.4% | 0% / 2.4% | 0% / 3.9% | 0% / 3.1% | 0% / 3.3% |
| vagn | 0% / 3.3% | 0% / 1.6% | 0% / 1.6% | 0% / 1.6% | 0% / 1.1% |
| ficklampa | 0% / 3.5% | 0% / 4.3% | 0% / 4.6% | 0% / 4.2% | 0% / 5.0% |

### Start weapon: spray (Sprayburk)

Policy `rush:spray`, nattvandraren, N=500 per night, base seed 1000.

| night | win rate | death time median (p10-p90) | level at 03:00 | median final level | peak enemies (median / max) |
|---|---|---|---|---|---|
| 1 | 15% | 3:08 (2:25-4:00) | 11 (n=77) | 9 | 133 / 180 |
| 2 | 4.6% | 2:33 (1:54-3:33) | 11 (n=23) | 8 | 128 / 180 |
| 3 | 0.8% | 2:02 (1:28-2:43) | 11 (n=4) | 7 | 122 / 180 |
| 4 | 0% | 1:43 (1:13-2:19) | n/a | 6 | 117 / 180 |
| 5 | 0% | 1:19 (1:02-1:48) | n/a | 5 | 103 / 180 |

Evolved % of all runs / damage share, per weapon:

| weapon | night 1 | night 2 | night 3 | night 4 | night 5 |
|---|---|---|---|---|---|
| nyckel | 0% / 2.2% | 0% / 2.5% | 0% / 1.7% | 0% / 2.9% | 0% / 2.3% |
| korv | 0% / 2.9% | 0% / 3.7% | 0% / 2.0% | 0% / 2.8% | 0% / 2.3% |
| telefon | 0% / 1.5% | 0% / 1.4% | 0% / 1.6% | 0% / 1.1% | 0% / 0.7% |
| spray (start) | 0% / 89% | 0% / 88% | 0% / 91% | 0% / 90% | 0% / 92% |
| vagn | 0% / 2.0% | 0% / 2.3% | 0% / 1.4% | 0% / 1.1% | 0% / 1.9% |
| ficklampa | 0% / 2.8% | 0% / 2.6% | 0% / 2.3% | 0% / 2.4% | 0% / 1.4% |

### Start weapon: vagn (Kundvagn)

Policy `rush:vagn`, nattvandraren, N=500 per night, base seed 1000.

| night | win rate | death time median (p10-p90) | level at 03:00 | median final level | peak enemies (median / max) |
|---|---|---|---|---|---|
| 1 | 3.8% | 2:51 (2:18-3:37) | 10 (n=19) | 8 | 157 / 180 |
| 2 | 0.2% | 2:18 (1:55-2:54) | 11 (n=1) | 7 | 159 / 180 |
| 3 | 0% | 1:59 (1:36-2:30) | n/a | 6 | 159 / 180 |
| 4 | 0% | 1:42 (1:26-2:05) | n/a | 5 | 158 / 180 |
| 5 | 0% | 1:30 (1:11-1:52) | n/a | 5 | 145 / 180 |

Evolved % of all runs / damage share, per weapon:

| weapon | night 1 | night 2 | night 3 | night 4 | night 5 |
|---|---|---|---|---|---|
| nyckel | 0% / 1.4% | 0% / 3.5% | 0% / 1.9% | 0% / 3.3% | 0% / 2.1% |
| korv | 0% / 3.2% | 0% / 3.4% | 0% / 2.5% | 0% / 2.2% | 0% / 3.1% |
| telefon | 0% / 2.2% | 0% / 1.1% | 0% / 1.7% | 0% / 1.0% | 0% / 1.0% |
| spray | 0% / 2.5% | 0% / 1.7% | 0% / 2.3% | 0% / 1.6% | 0% / 1.0% |
| vagn (start) | 0% / 88% | 0% / 88% | 0% / 90% | 0% / 89% | 0% / 91% |
| ficklampa | 0% / 2.8% | 0% / 2.7% | 0% / 1.8% | 0% / 2.7% | 0% / 1.7% |

### Start weapon: ficklampa (Ficklampa)

Policy `rush:ficklampa`, nattvandraren, N=500 per night, base seed 1000.

| night | win rate | death time median (p10-p90) | level at 03:00 | median final level | peak enemies (median / max) |
|---|---|---|---|---|---|
| 1 | 50% | 3:58 (2:38-4:00) | 12 (n=248) | 11 | 124 / 180 |
| 2 | 24% | 3:06 (2:15-4:00) | 12 (n=118) | 10 | 144 / 180 |
| 3 | 7.8% | 2:35 (1:52-3:47) | 12 (n=39) | 8 | 156 / 180 |
| 4 | 3.4% | 2:08 (1:35-3:01) | 12 (n=17) | 7 | 149 / 180 |
| 5 | 0.2% | 1:41 (1:14-2:14) | 11 (n=1) | 6 | 137 / 180 |

Evolved % of all runs / damage share, per weapon:

| weapon | night 1 | night 2 | night 3 | night 4 | night 5 |
|---|---|---|---|---|---|
| nyckel | 0% / 1.0% | 0% / 1.2% | 0% / 1.9% | 0% / 2.2% | 0% / 2.0% |
| korv | 0% / 2.8% | 0% / 2.5% | 0% / 1.4% | 0% / 2.5% | 0% / 1.4% |
| telefon | 0% / 1.9% | 0% / 1.1% | 0% / 0.9% | 0% / 0.5% | 0% / 1.2% |
| spray | 0% / 1.7% | 0% / 2.0% | 0% / 1.1% | 0% / 1.3% | 0% / 1.8% |
| vagn | 0% / 1.9% | 0% / 0.9% | 0% / 0.9% | 0% / 0.6% | 0% / 0.8% |
| ficklampa (start) | 0.4% / 91% | 0.4% / 92% | 0.4% / 94% | 0% / 93% | 0% / 93% |


## Appendix A: greedy-damage policy, N=200 per config **[measured]**

Takes evolution, then owned-weapon upgrades, Handskar, new weapons up to 4 slots, Laddare, Senap, Tandstickor. Builds are mixed, so the damage share column compares weapons against each other. Raw data: `baseline-greedy.json`.

### Start weapon: nyckel (Nyckel)

Policy `greedy`, nattvandraren, N=200 per night, base seed 1000.

| night | win rate | death time median (p10-p90) | level at 03:00 | median final level | peak enemies (median / max) |
|---|---|---|---|---|---|
| 1 | 28% | 3:39 (2:50-4:00) | 13 (n=57) | 11 | 112 / 180 |
| 2 | 2.5% | 2:55 (2:16-3:40) | 14 (n=5) | 10 | 117 / 180 |
| 3 | 0% | 2:34 (2:08-3:09) | n/a | 9 | 130 / 180 |
| 4 | 0% | 2:10 (1:46-2:35) | n/a | 8 | 126 / 180 |
| 5 | 0% | 1:55 (1:37-2:24) | n/a | 8 | 131 / 180 |

Evolved % of all runs / damage share, per weapon:

| weapon | night 1 | night 2 | night 3 | night 4 | night 5 |
|---|---|---|---|---|---|
| nyckel (start) | 0% / 36% | 0% / 38% | 0% / 46% | 0% / 52% | 0% / 54% |
| korv | 0% / 17% | 0% / 15% | 0% / 14% | 0% / 9.2% | 0% / 10% |
| telefon | 0% / 11% | 0% / 8.9% | 0% / 7.1% | 0% / 6.0% | 0% / 5.5% |
| spray | 0% / 11% | 0% / 11% | 0% / 9.6% | 0% / 10% | 0% / 9.7% |
| vagn | 0% / 12% | 0% / 9.9% | 0% / 9.9% | 0% / 7.5% | 0% / 7.1% |
| ficklampa | 0% / 13% | 0% / 17% | 0% / 13% | 0% / 15% | 0% / 14% |

### Start weapon: korv (Grillkorv)

Policy `greedy`, nattvandraren, N=200 per night, base seed 1000.

| night | win rate | death time median (p10-p90) | level at 03:00 | median final level | peak enemies (median / max) |
|---|---|---|---|---|---|
| 1 | 55% | 4:00 (3:19-4:00) | 13 (n=110) | 13 | 67 / 122 |
| 2 | 4.0% | 2:58 (2:20-3:48) | 13 (n=8) | 10 | 87 / 179 |
| 3 | 0% | 2:33 (2:01-3:11) | n/a | 9 | 107 / 180 |
| 4 | 0% | 2:09 (1:42-2:34) | n/a | 8 | 115 / 178 |
| 5 | 0% | 1:55 (1:22-2:17) | n/a | 8 | 123 / 178 |

Evolved % of all runs / damage share, per weapon:

| weapon | night 1 | night 2 | night 3 | night 4 | night 5 |
|---|---|---|---|---|---|
| nyckel | 0% / 5.5% | 0% / 5.8% | 0% / 8.6% | 0% / 10% | 0% / 11% |
| korv (start) | 0% / 57% | 0% / 57% | 0% / 53% | 0% / 55% | 0% / 55% |
| telefon | 0% / 8.9% | 0% / 8.8% | 0% / 8.1% | 0% / 5.8% | 0% / 5.5% |
| spray | 0% / 6.0% | 0% / 7.3% | 0% / 8.1% | 0% / 7.6% | 0% / 9.0% |
| vagn | 0% / 11% | 0% / 9.1% | 0% / 10% | 0% / 8.6% | 0% / 6.7% |
| ficklampa | 0% / 12% | 0% / 12% | 0% / 12% | 0% / 13% | 0% / 12% |

### Start weapon: telefon (Laddad telefon)

Policy `greedy`, nattvandraren, N=200 per night, base seed 1000.

| night | win rate | death time median (p10-p90) | level at 03:00 | median final level | peak enemies (median / max) |
|---|---|---|---|---|---|
| 1 | 28% | 3:33 (2:37-4:00) | 13 (n=56) | 11 | 79 / 180 |
| 2 | 3.5% | 2:52 (2:12-3:38) | 13 (n=7) | 10 | 105 / 180 |
| 3 | 0% | 2:28 (1:56-2:58) | n/a | 9 | 123 / 180 |
| 4 | 0% | 2:02 (1:34-2:33) | n/a | 7 | 128 / 180 |
| 5 | 0% | 1:47 (1:17-2:09) | n/a | 7 | 131 / 180 |

Evolved % of all runs / damage share, per weapon:

| weapon | night 1 | night 2 | night 3 | night 4 | night 5 |
|---|---|---|---|---|---|
| nyckel | 0% / 7.4% | 0% / 8.1% | 0% / 8.8% | 0% / 14% | 0% / 15% |
| korv | 0% / 18% | 0% / 17% | 0% / 18% | 0% / 16% | 0% / 11% |
| telefon (start) | 0% / 42% | 0% / 39% | 0% / 36% | 0% / 37% | 0% / 38% |
| spray | 0% / 7.6% | 0% / 11% | 0% / 9.7% | 0% / 10% | 0% / 11% |
| vagn | 0% / 11% | 0% / 10% | 0% / 12% | 0% / 8.5% | 0% / 8.2% |
| ficklampa | 0% / 13% | 0% / 14% | 0% / 17% | 0% / 14% | 0% / 17% |

### Start weapon: spray (Sprayburk)

Policy `greedy`, nattvandraren, N=200 per night, base seed 1000.

| night | win rate | death time median (p10-p90) | level at 03:00 | median final level | peak enemies (median / max) |
|---|---|---|---|---|---|
| 1 | 30% | 3:33 (2:44-4:00) | 13 (n=60) | 11 | 77 / 180 |
| 2 | 4.0% | 2:54 (2:15-3:37) | 13 (n=8) | 10 | 96 / 175 |
| 3 | 0% | 2:22 (1:47-3:00) | n/a | 9 | 107 / 180 |
| 4 | 0% | 2:06 (1:34-2:32) | n/a | 8 | 110 / 180 |
| 5 | 0% | 1:48 (1:21-2:13) | n/a | 7 | 118 / 180 |

Evolved % of all runs / damage share, per weapon:

| weapon | night 1 | night 2 | night 3 | night 4 | night 5 |
|---|---|---|---|---|---|
| nyckel | 0% / 8.0% | 0% / 7.5% | 0% / 11% | 0% / 10% | 0% / 11% |
| korv | 0% / 18% | 0% / 18% | 0% / 14% | 0% / 14% | 0% / 11% |
| telefon | 0% / 12% | 0% / 9.8% | 0% / 9.5% | 0% / 8.0% | 0% / 6.7% |
| spray (start) | 0% / 34% | 0% / 40% | 0% / 42% | 0% / 47% | 0% / 49% |
| vagn | 0% / 15% | 0% / 10% | 0% / 7.8% | 0% / 8.8% | 0% / 11% |
| ficklampa | 0% / 14% | 0% / 15% | 0% / 16% | 0% / 12% | 0% / 12% |

### Start weapon: vagn (Kundvagn)

Policy `greedy`, nattvandraren, N=200 per night, base seed 1000.

| night | win rate | death time median (p10-p90) | level at 03:00 | median final level | peak enemies (median / max) |
|---|---|---|---|---|---|
| 1 | 37% | 3:39 (2:41-4:00) | 13 (n=73) | 11 | 79 / 180 |
| 2 | 3.0% | 2:52 (2:19-3:33) | 13 (n=6) | 10 | 95 / 180 |
| 3 | 0% | 2:27 (1:53-2:58) | n/a | 9 | 118 / 180 |
| 4 | 0% | 2:07 (1:43-2:32) | n/a | 8 | 127 / 180 |
| 5 | 0% | 1:50 (1:29-2:13) | n/a | 7 | 130 / 180 |

Evolved % of all runs / damage share, per weapon:

| weapon | night 1 | night 2 | night 3 | night 4 | night 5 |
|---|---|---|---|---|---|
| nyckel | 0% / 6.7% | 0% / 8.7% | 0% / 9.0% | 0% / 12% | 0% / 13% |
| korv | 0% / 18% | 0% / 19% | 0% / 16% | 0% / 13% | 0% / 13% |
| telefon | 0% / 9.9% | 0% / 8.4% | 0% / 8.0% | 0% / 5.8% | 0% / 5.9% |
| spray | 0% / 8.2% | 0% / 8.7% | 0% / 10% | 0% / 11% | 0% / 12% |
| vagn (start) | 0% / 46% | 0% / 42% | 0% / 43% | 0% / 42% | 0% / 43% |
| ficklampa | 0% / 12% | 0% / 13% | 0% / 13% | 0% / 16% | 0% / 14% |

### Start weapon: ficklampa (Ficklampa)

Policy `greedy`, nattvandraren, N=200 per night, base seed 1000.

| night | win rate | death time median (p10-p90) | level at 03:00 | median final level | peak enemies (median / max) |
|---|---|---|---|---|---|
| 1 | 41% | 3:46 (2:49-4:00) | 13 (n=81) | 12 | 68 / 132 |
| 2 | 6.5% | 2:53 (2:19-3:51) | 14 (n=13) | 10 | 86 / 153 |
| 3 | 0% | 2:34 (2:01-3:11) | n/a | 9 | 110 / 180 |
| 4 | 0% | 2:10 (1:46-2:33) | n/a | 8 | 117 / 180 |
| 5 | 0% | 1:51 (1:31-2:13) | n/a | 7 | 122 / 180 |

Evolved % of all runs / damage share, per weapon:

| weapon | night 1 | night 2 | night 3 | night 4 | night 5 |
|---|---|---|---|---|---|
| nyckel | 0% / 7.6% | 0% / 7.0% | 0% / 8.9% | 0% / 8.7% | 0% / 8.8% |
| korv | 0% / 20% | 0% / 17% | 0% / 14% | 0% / 14% | 0% / 11% |
| telefon | 0% / 9.2% | 0% / 9.8% | 0% / 7.4% | 0% / 5.6% | 0% / 5.9% |
| spray | 0% / 7.1% | 0% / 9.0% | 0% / 9.0% | 0% / 9.1% | 0% / 9.7% |
| vagn | 0% / 12% | 0% / 11% | 0% / 9.2% | 0% / 9.4% | 0% / 6.7% |
| ficklampa (start) | 0% / 45% | 0% / 46% | 0% / 52% | 0% / 53% | 0% / 58% |


## Appendix B: does a head start fix evolution? **[measured]**

Same as the baseline (rush, N=200 for the second half) but with meta upgrade `startWeaponLevel=3`, so the starting weapon begins at level 4. Cells are win rate / starting-weapon evolution rate. Raw data: `sens-startlevel4.json`.

| start weapon | night 1 | night 2 | night 3 | night 4 | night 5 |
|---|---|---|---|---|---|
| nyckel, baseline (start level 1) | 32% / 0% | 10% / 0% | 3.4% / 0% | 0.2% / 0% | 0% / 0% |
| korv, baseline (start level 1) | 28% / 0% | 4.2% / 0% | 0.2% / 0% | 0% / 0% | 0% / 0% |
| telefon, baseline (start level 1) | 5.8% / 0% | 0.6% / 0% | 0% / 0% | 0% / 0% | 0% / 0% |
| spray, baseline (start level 1) | 15% / 0% | 4.6% / 0% | 0.8% / 0% | 0% / 0% | 0% / 0% |
| vagn, baseline (start level 1) | 3.8% / 0% | 0.2% / 0% | 0% / 0% | 0% / 0% | 0% / 0% |
| ficklampa, baseline (start level 1) | 50% / 0.4% | 24% / 0.4% | 7.8% / 0.4% | 3.4% / 0% | 0.2% / 0% |
| nyckel, start level 4 | 68% / 9.0% | 35% / 11% | 16% / 7.0% | 6.5% / 6.5% | 1.5% / 2.5% |
| korv, start level 4 | 77% / 11% | 28% / 8.0% | 4.5% / 3.5% | 0% / 1.0% | 0% / 0.5% |
| telefon, start level 4 | 21% / 3.0% | 3.0% / 1.5% | 0.5% / 1.0% | 0% / 0% | 0% / 0% |
| spray, start level 4 | 14% / 2.0% | 4.5% / 1.5% | 0.5% / 0% | 0% / 0% | 0% / 0% |
| vagn, start level 4 | 7.5% / 0.5% | 0% / 0% | 0% / 0% | 0% / 0% | 0% / 0% |
| ficklampa, start level 4 | 61% / 12% | 45% / 14% | 13% / 5.0% | 7.5% / 7.5% | 2.0% / 2.0% |

**[interpretation]** A level-4 start moves evolution from about 0% to 1-14% on the strong starters and still leaves Kundvagn, Laddad telefon and Sprayburk near 0%. Evolution is gated by pick count, not by weapon strength.

## Reproduce

```bash
node tools/balance.mjs --nights 1-5 --weapons all --n 500 --policy rush --out specs/balance/baseline.json
node tools/balance.mjs --nights 1-5 --weapons all --n 200 --policy greedy --out specs/balance/baseline-greedy.json
node tools/balance.mjs --nights 1-5 --weapons all --n 200 --policy rush --mods startWeaponLevel=3 --out specs/balance/sens-startlevel4.json
```

Same inputs give byte-identical JSON, with any `--workers` count.
