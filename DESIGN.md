# SISTA BUSSEN — Game Design & Monetization Spec

> Working title: **SISTA BUSSEN** ("The Last Bus"). Swedish, mundane-horror, darkly funny.
> Platform: mobile web (PWA, portrait, one thumb), playable on desktop with keyboard for testing.
> Status: v1 spec, approved for build.

---

## 1. Why this game will work

The brief: adults with a bit of boredom, something they will get hooked on, monetized through ads and small
purchases that make them stronger and cooler.

Three proven mechanics are combined, each already validated at massive scale on mobile:

1. **Survivor-like auto-battler** (Vampire Survivors, Survivor.io, Mr Autofire). The strongest retention loop on
   mobile right now: 3–5 minute sessions, zero skill barrier to start, exponential power growth inside a run,
   and a death that always feels like *your* fault, so you immediately want one more run. Auto-attack means one
   thumb is enough — essential for the target audience.
2. **Roguelite meta-progression.** Each run banks permanent currency. Losing still advances you. This is the
   mechanism that converts "a bit bored" into a daily habit, because the account always gets stronger.
3. **Time-boxed night with a win state.** Every run has a diegetic goal: survive until the last bus arrives at
   03:00. This is a much better hook than "survive as long as you can", because it creates a promise the player
   can almost keep, and a natural cliffhanger ("I almost made the bus").

**The unique hook:** the revive mechanic is diegetic. When you die, the bus is *delayed*. Watching an ad does not
feel like a monetization interruption — it feels like the game giving you a second chance with a joke attached.
That single design choice is what makes the ad inventory feel generous instead of hostile, and it is why the
monetization works without damaging retention.

**Tone:** a bus stop at night, bad fluorescent light, wet asphalt, pigeons, a vending machine that only takes
coins. The horror is bureaucratic and Swedish, not gory. Funny, not childish — the audience is adults. No gore,
no gambling-adjacent visuals beyond clearly-labelled crates, no microtransactions that gate progress.

---

## 2. Core loop

```
Menu (Kuren) → pick character + starting weapon → NIGHT N
   ↓
Survive 4 real minutes until 03:00 (bus arrival)
   ↓  level ups every ~20s → choose 1 of 3 upgrades  ← the dopamine core
   ↓  die → RUN OVER
   ↓      ├─ "BUSSEN ÄR FÖRSENAD" (rewarded ad) → revive, 1–2× per run
   ↓      ├─ "DUBBLA VÄXLET" (rewarded ad) → 2× run currency
   ↓      └─ back to Kuren, spend Biljetter on permanent power
   ↓  win at 03:00 → next night unlocks (harder), bonus payout
   ↓
Kuren: permanent upgrades, weapon unlocks, contracts, daily crate
```

Session length: 3–6 minutes. Perfect for a commute, a queue, a boring meeting.

---

## 3. Mechanics

### 3.1 Controls
- **Touch:** drag anywhere on the screen to move (floating virtual stick appears under the thumb). No fixed
  stick position — thumb placement is wherever the player's hand already is. Auto-attack, no aiming.
- **Desktop:** WASD / arrows. Pause on `Esc` / `P`.
- **One-hand operation** is a hard requirement. Nothing requires two thumbs.

### 3.2 Player
Stats: `hp`, `speed`, `damage` (multiplier), `attackSpeed`, `area`, `projectiles`, `crit`, `pickupRadius`,
`regen`, `luck`, `armor`.

Base: 100 hp, speed 132 px/s, 1.0 damage mult, 1.0 attack speed, pickup radius 48.

### 3.3 Weapons (auto-firing, 8 levels each)
| id | name | behaviour | evolution |
|---|---|---|---|
| `nyckel` | Nyckel (key on a chain) | orbiting melee arc | + `handskar` → **Huvudnyckeln** (bigger orbit, stuns) |
| `korv` | Grillkorv | thrown piercing projectile | + `senap` → **Dubbelkorv** (explodes on pierce end) |
| `telefon` | Laddad telefon | chain lightning, 3 targets | + `laddare` → **Roaming** (chains 8, stuns) |
| `spray` | Sprayburk | cone AoE, damage over time | + `tandstickor` → **Molotov** (fire pool) |
| `vagn` | Kundvagn | bouncing ricochet projectile | + `mynt` → **Stridsvagnen** (3 bounces, +pierce) |
| `ficklampa` | Ficklampa | forward beam, pierces all | + `batteri` → **Strålkastaren** (wide, burns) |

Evolution requires the base weapon at max level (8) **and** the named passive at level 3+. This is the explicit
"build goal" that makes players replay. On evolution the weapon slot glows and the run gets visibly stronger —
this is the "cooler" moment the brief asks for.

### 3.4 Passives (5 levels each)
`handskar` (damage), `kondis` (speed), `senap` (area), `laddare` (attack speed), `tandstickor` (crit),
`mynt` (pickup radius + currency gain), `batteri` (max hp + armor), `termos` (regen).

### 3.5 Level-up flow
XP threshold curve: `40 * level^1.35`. On level up the game pauses and shows 3 cards drawn from the valid pool
(weapons not maxed, passives not maxed, evolutions when eligible). Cards are weighted: evolution > new weapon >
weapon upgrade > passive. Reroll costs 1.0× and is also available via rewarded ad. Reroll count resets per run.

### 3.6 Enemies (scale with night index)
| id | name | behaviour |
|---|---|---|
| `fyllo` | Fyllo | slow chaser, tanky |
| `duva` | Duva | fast swarm, weak, spawns in flocks |
| `skugga` | Skugga | fast, erratic pathing, fades in/out |
| `vaktmastare` | Vaktmästare | keeps distance, throws cones (projectile) |
| `sparkcykel` | Elsparkcykel | charges in a straight line, telegraphs |
| `nattvakt` | Nattvakten | **boss at 02:30** — summons duvor, radial burst |
| `chauffor` | Busschauffören | **boss at 03:00** — final wall before the bus |

Spawn director: scripted intensity curve per second, multiplied by night difficulty
(`1 + 0.18 * (night - 1)`), capped to keep mobile frame rate. Max ~180 live enemies; oldest despawn.

### 3.7 Death, revive, win
- Death → run summary with fares earned, night progress, best night.
- **Revive** ("BUSSEN ÄR FÖRSENAD"): rewarded ad, restores 60% hp, clears the screen, gives 3s invulnerability.
  Available **twice** per run (2nd revive also ad). This is the highest-value ad slot and the reason players
  tolerate the ad SDK.
- **Win:** at 03:00 the bus arrives, run ends in victory, pays a night-completion bonus, unlocks next night.
  Nights are endless and get harder; night 10+ is the prestige loop.

### 3.8 Persistence
`localStorage`, versioned schema (`sista-bussen.save.v1`), migrated forward, corrupt-save safe (falls back to a
fresh profile rather than crashing).

---

## 4. Monetization

Principles: **every ad is player-initiated or clearly announced, every purchase is permanent power or pure
cosmetics, and nothing blocks the run the player is enjoying.** No energy system, no timers, no pay-to-win wall —
this audience has no patience for that and it kills retention.

### 4.1 Rewarded ads (the main revenue line)
| placement | reward | cap |
|---|---|---|
| `revive` | continue the run | 2 per run |
| `double_fares` | 2× run currency | 1 per run |
| `reroll` | reroll upgrade cards | 3 per run |
| `free_crate` | daily crate, extra pull | 3 per day |
| `contract_skip` | complete a contract | 1 per day |

All through a single `AdProvider` interface. Frequency guard: interstitial at most once per 3 completed runs and
never within 90s of the previous one, never during a run, never on first-run onboarding.

### 4.2 IAP
| sku | price (indicative, SEK) | content |
|---|---|---|
| `remove_ads` | 39 | removes interstitials, keeps rewarded (they are a benefit) |
| `starter_pack` | 59 | 1 500 Biljetter + 1 weapon unlock token |
| `vip_pass` | 79 / night-cycle | cosmetic skins, +25% fares, daily crate upgrade |
| `tickets_small` | 25 | 800 Biljetter |
| `tickets_large` | 99 | 4 000 Biljetter |

Prices live in one config file and are the only place they are defined — the UI reads them, never hardcodes.

### 4.3 Currency
- `Biljetter` (tickets) — persistent, earned in runs and from contracts, spent on permanent upgrades.
- `Växel` (change) — run currency, converted to Biljetter at run end. The "double fares" ad doubles this.
- Cosmetic `Färger` (colour variants) unlocked with Biljetter only. No loot boxes. No randomness in purchases.

### 4.4 Retention
- Daily crate with a visible streak (day 7 = guaranteed weapon unlock).
- 3 rotating contracts ("Survive to 02:00 with only Nyckel", "Kill 300 duvor"). These are the return-reason.
- Local best-night record + a "ghost" of your best run displayed as a faint silhouette for self-competition.
  No mandatory account, no login wall.

---

## 5. Art & audio direction

- **Palette:** wet-asphalt near-black `#0b0e12`, sodium-lamp amber `#f5a524`, bus-sign green `#3ddc97`, cold
  fluorescent `#7fd7ff`, danger red `#ff4d5e`. High contrast, readable at 30% brightness on a phone at night.
- **Look:** flat vector silhouettes with 2px rim light, heavy vignette, film grain at 4% opacity, bloom on
  emissive elements. Cheaper to render than pixel art and it reads as deliberate style rather than asset-pack.
- **Feel (this is what separates a good clone from a bad one):** hit flash, 90ms hitstop on kill, screen shake
  scaled to damage, floating damage numbers, XP orbs that snap to the player with easing, chromatic aberration on
  level-up, card fan animation. Every kill must produce at least two feedback signals.
- **Audio:** synthesized with WebAudio (no asset downloads). Lo-fi rain loop, low sub-bass pulse that intensifies
  with wave, distinct hit/kill/levelup/purchase sounds. Mute toggle persisted.

---

## 6. Technical plan

- TypeScript, Vite, Canvas 2D. No game engine, no UI framework. Small dependency surface = it still builds in a
  year and it loads in under 2 seconds on 4G.
- Deterministic simulation core in `src/sim/` — pure functions, seeded RNG, unit tested. Rendering and input are
  separate so the sim is testable headlessly.
- Target: 60 fps on a 2021 mid-range Android, 4-minute runs with 150+ entities.
- PWA: manifest, installable, offline-capable after first load, portrait lock in manifest, safe-area insets.
- Tests: Vitest for sim (spawn curve, level curve, upgrade pool legality, evolution rules, save migration,
  ad frequency guard, economy payout). Playwright for boot + play + screenshot evidence.
- Analytics: `track(event, props)` adapter, no-op console in dev.

### 6.1 File layout
```
index.html
src/main.ts               boot, screen router
src/game.ts               run orchestration
src/sim/                  entities, spawn director, combat, upgrades, rng, curve
src/render/               canvas renderer, particles, camera, hud
src/audio/                webaudio synth
src/meta/                 save, economy, shop, contracts, daily
src/monetize/             AdProvider, IapProvider, guards, catalog
src/ui/                   DOM overlays: menu, levelup, summary, shop
tests/                    vitest + playwright
```

---

## 7. Definition of done for v1

1. `npm run build` succeeds with no type errors.
2. `npm test` green, covering the curves and the monetization guards.
3. A full run is playable start to finish: move, kill, level up, evolve a weapon, die, revive via the ad flow,
   win a night, spend Biljetter on a permanent upgrade, see the effect in the next run.
4. Playwright produces screenshots of menu, active run, level-up cards, and run summary.
5. Save survives a page reload.