# ZOMBUS (working name) — v2 design (zombie route)

Status: **approved by Max 2026-11-09** (defaults 2–6 accepted; name below). Written 2026-11-08 by Totto from
Max's brief and four decisions he made the same evening. Supersedes the night/03:00 framing in `DESIGN.md` §1–2 and `LORE.md`. The combat feel
(`src/sim/` movement, auto-weapons, level-up cards, enemy behaviours, juice) stays. Max: "I love the current
gameplay — it's a great foundation."

Lines marked **[DEFAULT]** are Totto's choices where Max didn't specify. Max can veto any of them before the
tickets are cut.

## Decided by Max (2026-11-08)

| Topic | Decision |
|---|---|
| Genre | Zombie survivor-like, same graphical style |
| Structure | Endless route of maps. After each map, choose the next from **2–4 options** (branching). **Boss every 10 maps.** |
| Map goal | **Fuel quota, then reach the bus.** Kill zombies and pick up fuel; once the quota is met, get back to the bus to leave. |
| Death | **Back to the last boss checkpoint** (map 1, 11, 21, …). Materials and permanent upgrades are kept. |
| Materials | Three types, each used alone or in combination, to upgrade **character, weapons and bus** (bus = a second passive layer). |
| Setting | **Generic international**, English. |
| Monetization | IAP + IAA. At launch: **remove ads + starter pack** (App Store build only) plus rewarded ads with the 12-min onboarding gate (#9). |
| Lore | Sole survivor, scavenging scrap to fight through. The bus is the only transport. The goal is to keep going in the hope of finding other human survivors somewhere along the route. |

## Name

**Decided (Max, 2026-11-09):** the working name is **ZOMBUS**, used for the in-game title, manifest name and
app display name. It is **not** the store name: "ZombUs" is a post-apocalyptic Steam game (April 2026), so the
final name is picked and availability-checked before the App Store submission. Repo, domain
(`sista-bussen.vasthavm.com`) and save keys keep `sista-bussen`.

## Core loop

```
Bus (hub) ── spend materials: Character / Weapons / Bus
   │
   ▼
Route map: pick 1 of 2–4 next stops (type + risk + reward shown)
   │
   ▼
MAP (2–4 min): auto-combat as today, level-up cards as today
   goal: fill the fuel gauge (quota), then reach the bus
   ├─ extract → map cleared: materials banked, next stop unlocked
   └─ die → revive (rewarded ad) or back to the last checkpoint
   │
   ▼
every 10th map: BOSS stop → clearing it sets the new checkpoint
```

## Map

- **Objective.** A fuel quota scaled by route depth. Fuel comes from canisters placed on the map and drops from
  zombies. When the quota is met the bus horn sounds, an arrow points to the bus, and the horde ramps up.
  Touching the bus extracts.
- **Pressure** stays time-based. Today's spawn director keeps ramping with elapsed time, so dawdling is the risk.
  Staying after the quota for more scrap is a deliberate risk/reward choice.
- **[DEFAULT]** In-map level-up cards and weapon levels **reset every map**. Each map is a complete
  survivor-like run, which keeps today's loop and balance intact. Long-term growth comes only from material
  upgrades.
  - Alternative: carry card levels across a 10-map segment. That's a stronger "build" fantasy, but every map's
    balance then depends on the ones before it. Not chosen; flagged.
- **Starting loadout** comes from the bus's weapon rack (the #5 loadout row stays).
- **Difficulty** = `depth` (map index on the route). It replaces `night` in `nightDifficulty`, with the same
  curve shape, re-tuned with the #11 harness.

## Route

- Seeded, endless, generated per checkpoint segment of 10. Each stop offers **2–4** next options. Each option
  shows its type, a danger pip (1–3) and its main reward.
- **[DEFAULT] Stop types:**
  - **Street**: normal.
  - **Gas station**: fuel-rich, lower quota, more zombies.
  - **Scrapyard**: more Scrap.
  - **Pharmacy**: more Supplies.
  - **Depot**: more Parts.
  - **Horde**: elite density, double rewards.
  - **Safe stop**: no combat. A free repair/heal and a small material trade. At most one per segment.
- **Boss** on maps 10, 20, 30, …: a fixed arena with a boss and its adds. Clearing it is the checkpoint. Boss
  types rotate and scale with depth.
- **[DEFAULT]** The route is fixed per segment seed, so a retry after death faces the same map options. That's
  fair and learnable.

## Materials and upgrades

**[DEFAULT]** Three materials:

| Material | Source | Alone upgrades |
|---|---|---|
| **Scrap** | every zombie, Scrapyards | **Weapons**: base damage/level-cap tiers, unlock weapons on the rack |
| **Parts** | elites, Depots, bosses | **Bus**: the passive layer (below) |
| **Supplies** | Pharmacies, canisters, Safe stops | **Character**: HP, speed, pickup radius, revive HP |

**[DEFAULT] Combinations** are the build depth:
- Scrap + Parts → **weapon mods** (e.g. +1 projectile, pierce).
- Scrap + Supplies → **evolution unlocks**. These replace "level 8 + passive 3", which the #11 harness showed
  is practically unreachable. Unlocking lets the evolution card appear in-map once the weapon hits a lower level.
- Parts + Supplies → **bus crew perks** (e.g. start each map with a turret, fuel magnet).

**Bus upgrades (passive layer).** Fuel tank (lower quota), plow (contact damage while extracting), turret
(fires at zombies near the bus), radio (reveals stop rewards one step further), armor (bus HP for the boss
arenas), storage (material gain %).

**Migration.** Existing saves convert Biljetter → Scrap (1:1). Existing shop upgrades map to the nearest
character upgrade. The save version goes to v3 with a migration test, as #9 did.

## Enemies (reskin, behaviours kept)

| Today | v2 | Behaviour (unchanged) |
|---|---|---|
| Fyllo | Shambler | slow, tanky chaser |
| Duva | Crawler swarm | fast, weak, flocks |
| Skugga | Runner | fast, erratic, fades |
| Vaktmästare | Spitter | keeps distance, ranged |
| Elsparkcykel | Charger | telegraphed straight charge |
| Nattvakten | Boss: The Warden | summons crawlers, radial burst |
| Busschauffören | Boss: The Conductor | final-wall style |

**[DEFAULT]** Weapons keep their mechanics and get scavenger names: wrench on a chain, nail gun, taser, fire
extinguisher, shopping cart, flashlight. Art direction stays the same: palette, silhouettes, rim light, grain.
Zombies get desaturated green-grey skin tones and torn silhouettes. The art pass (#3) folds into the reskin.

## Lore (text only, cheap to change)

- **Cold open (4 frames).**
  1. A dead city, a bus with its lights on.
  2. "Everyone else is gone. The bus still runs."
  3. A hand-drawn route map with a circled word: SURVIVORS?
  4. "Find fuel. Keep moving."
- **Radio.** Every boss cleared unlocks a crackling radio message, short and text-only, that hints at survivors
  further down the route. It's the endless carrot and never resolves.
- Revive copy: "Not today." Extraction: "All aboard."

## Monetization

- **Rewarded (player-initiated, after the 12-min gate from #9):**
  - revive (2 per map)
  - double materials (end of map)
  - reroll (3 per map)
  - free daily crate pull
  - **[DEFAULT]** fuel top-up (+25% quota progress, 1 per map)
- **[DEFAULT] Interstitials** return with IAA, after the 12-min gate only: between maps, at most 1 per 3 maps,
  never mid-map, never after a death, never in the first session. That's needed for "remove ads" to mean
  anything. `INTERSTITIALS_ENABLED` flips to true with this ticket.
- **IAP (App Store build only, StoreKit via Capacitor):**
  - `remove_ads`: removes interstitials. Rewarded stays opt-in.
  - `starter_pack`: one-time materials + a weapon unlock.
  
  Both are non-consumable or one-time, with a restore path, per guideline 3.1.1. The web build sells nothing.
- All prices and caps stay in `src/monetize/catalog.ts`.

## What happens to existing work

| Item | Fate |
|---|---|
| #6, #10 update flow, #9 ad gate | kept as is |
| #5 menu | the loadout row stays; the night selector is replaced by the route map |
| #8 Capacitor | kept; IAP lands there |
| #11 harness | kept; extended for the fuel/extract win condition |
| #7 lore (night/03:00) | **superseded**, close |
| #4 tune nights 4+ | **superseded** by the v2 balance pass |
| #3 art pass | folded into the zombie reskin |
| #2 ads/billing | split into the v2 monetization tickets |

## Build order (tickets follow this)

1. **Sim: map objective.** Fuel quota, fuel and material drops, the bus extraction zone, depth-based difficulty.
   Unfreezes `src/sim/` deliberately. The harness learns the new win condition first.
2. **Route + save v3.** Seeded route generator, stop types, checkpoints, death to checkpoint, Biljetter → Scrap
   migration.
3. **Upgrade trees.** Character, weapons and bus from 3 materials plus combinations. Replaces the Kuren shop.
4. **UI.** Route map screen, bus hub, map HUD (fuel gauge, extraction arrow), end-of-map summary.
5. **Reskin + English copy.** Zombies, weapon names, LAST BUS branding, cold open and radio lore.
6. **Bosses every 10 maps.**
7. **Monetization v2.** Rewarded remap, interstitials, StoreKit IAP. Waits on Apple verification.
8. **Balance pass.** Harness targets per depth band, plus a human playtest.

1 and 2 run in parallel under a shared contract (`MapConfig` in, `MapResult` out). 3–5 follow, and 5 can start
in parallel with 3.
