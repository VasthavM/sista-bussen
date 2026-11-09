# Weapon balance v2 (ticket #14)

Every changed number, old -> new. Only numbers changed; no `name`/`desc` string was touched. Evidence: `v2-baseline.md` (before/after per weapon). Method: depth 1, `street`, rush policy, seed 1000; baseDamage/baseCooldown swept per weapon at N=200-300 until depth 1 extraction landed near 45%, then confirmed at N=500.

## Weapon numbers (`src/sim/content.ts`)

| weapon | field | old | new | reason |
|---|---|---|---|---|
| nyckel | baseDamage | 17 | 20 | 36% -> 45%; the orbit was fine, this just lines it up with the others |
| korv | baseDamage | 23 | 26 | 25% -> 44%; the throw pierces but hit too rarely to clear the horde at depth 1 |
| telefon | baseDamage | 21 | 24 | with the faster cooldown, keeps a chain hit worth a kill on fyllo (52 hp) after one or two links |
| telefon | baseCooldown | 2.1 | 1.4 | 6.8% -> 44%; one zap every 2.1 s could not keep up with spawns. Still a 3+ target lightning chain, only quicker |
| spray | baseDamage | 10 | 17 | 16% -> 46%; the cone ticks 3x per use at 0.34x damage, so the base was too low to burn through anything |
| vagn | baseDamage | 18 | 25 | 4.8% -> 45%; one projectile, 1 pierce and 1 bounce needs real hit damage |
| vagn | baseCooldown | 1.8 | 1.3 | a shot every 1.8 s left the cart idle most of the time; it still bounces between targets and fences |
| ficklampa | baseDamage | 14 | 11 | 58% -> 46%; the beam pierces everything in a line, so it ran away from the pack |

Unchanged: all `baseCooldown` not listed (nyckel 0.55, korv 1.35, spray 1.5, ficklampa 1.25), colours, behaviours, evolved numbers (evolved damage/cooldown multipliers, pierce 7, chain 8, 3 bounces and the beam widths are literals in `src/sim/combat.ts`, untouched), enemy stats, spawns, movement, fuel and quota.

Identity check: orbit stays an orbit (radius, stun on evolution), the beam stays a straight piercing beam, the telefon still chains 3+ targets, the korv still throws and pierces, the vagn still bounces. Only how often and how hard each fires changed. Per-level scaling (`0.32` per weapon level, `28%` shown on the card) is a literal in `combat.ts` and `upgrades.ts` and is unchanged.

Passive numbers (`state.ts`, 12% damage per level and so on) were not changed: the spread was solved with weapon numbers alone.

## Early evolution (`src/sim/types.ts`, `src/sim/upgrades.ts`)

| item | old | new |
|---|---|---|
| `MetaMods.evolutionUnlocks` | n/a | `readonly WeaponId[]`, default `[]` in `EMPTY_MODS` |
| evolution eligibility, weapon level | 8 | 5 if the weapon is in `evolutionUnlocks`, else 8 |
| evolution eligibility, passive level | 3 | 2 if unlocked, else 3 |
| evolution card with level < 8 | n/a | offered next to the next-level card (unlocked weapons only) |
| evolution path card | n/a | for an unlocked, unevolved weapon, 35% of level-ups put one "next step" card (next weapon level, the passive, or the evolution) in the roll (`EVOLUTION_PATH_CHANCE`). Without an unlock the roll code is skipped, so RNG draws and cards are exactly as before |

Why the path card: the eligibility change alone reached 13% of extracted depth-1 runs. A run only has about 10 level-ups, needs 6 specific cards (4 weapon levels, 2 passive levels) and sees a given card in about a third of rolls. With the path card: 54% to 68% of extracted runs evolve the starting weapon. At 25% chance one weapon (spray) fell under the 35% target (31%), at 100% every run evolved and depth-1 extraction hit 80-99%, so 35% it is. An evolution still sets the weapon to level 8 (unchanged `applyChoice`), so an early evolution is a power spike; that is the point of the unlock. With `--unlock all` depth-1 extraction goes up by 0 to 25 points (spray 0, telefon +25).

## Side changes outside the named files

- `src/meta/shop.ts`: `modsFromProfile` returns `evolutionUnlocks: []` so the required field type-checks. One line. #15 owns this file and will wire the real unlock; expect a trivial merge conflict there.
- `tools/balance.mjs`, `tools/balance-lib.ts`: `--unlock <weapon|all|a,b>` flag, `BalanceConfig.unlock`, and a new report column `startEvolvedOfExtracted` (share of extracted runs where the start weapon evolved).
- `tests/upgrades.test.ts`: unlock eligibility, both thresholds, old rule intact for non-unlocked weapons, evolution beside the level card, path-card share and legality.

## Open

- Depth 3 for telefon and vagn is 0.7% (2 of 300). They clear the "not 0% before depth 4" bar but are thin; the per-depth pass (v2-8) should look at late-game scaling, not at depth-1 numbers.
- The unlock makes depth 1 easy for telefon (69%) and vagn (62%). Fine for a meta purchase, but #15 should price it as a real power step.
