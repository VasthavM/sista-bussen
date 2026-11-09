# ZOMBUS names (ticket #17), for Max to review

Everything player-facing in English, scavenger tone. Internal ids (`nyckel`, `fyllo`, `nattvandraren` …) did not change: they key saves, tests and the sim, and renaming them is a separate migration. Only `name`/`desc` strings did.
`tests/english.test.ts` fails if a name in `src/sim/content.ts` is missing from this file.

## Weapons (mechanics unchanged)

| id | name | evolved name | pairs with passive | notes |
|---|---|---|---|---|
| `nyckel` | Chain Wrench | Wrecking Chain | Work Gloves | orbiting arc, evolved stuns |
| `korv` | Nail Gun | Nail Bomb | Blast Caps | piercing shot, evolved explodes at the end of the pierce |
| `telefon` | Taser | Overcharge | Jump Starter | chain lightning, evolved chains 8 and stuns |
| `spray` | Torch Spray | Napalm | Matchbook | cone damage over time, evolved leaves a fire pool |
| `vagn` | Shopping Cart | Armored Cart | Scrap Magnet | ricochet, evolved bounces 3 times and pierces |
| `ficklampa` | Flashlight | Searchlight | Riot Vest | piercing beam, evolved is wide and burns |

The design doc says "fire extinguisher" for `spray`. The ticket says **Torch Spray**, so that won.

## Passives

| id | name | effect |
|---|---|---|
| `handskar` | Work Gloves | damage |
| `kondis` | Running Shoes | move speed |
| `senap` | Blast Caps | area |
| `laddare` | Jump Starter | attack speed |
| `tandstickor` | Matchbook | crit chance |
| `mynt` | Scrap Magnet | pickup radius and scrap gain |
| `batteri` | Riot Vest | max HP and armor |
| `termos` | Canteen | regeneration |

## Characters

| id | name | title |
|---|---|---|
| `nattvandraren` | Drifter | Used to the dark |
| `pensionaren` | Old Timer | Has seen worse |
| `studenten` | Scrounger | Quick hands |

## Enemies

| id | name | look |
|---|---|---|
| `fyllo` | Shambler | wide brown hunch, torn coat, both arms out, yellow eyes |
| `duva` | Crawler | tiny pale torso dragging itself forward, swarms |
| `skugga` | Runner | lean blue hoodie, rags streaming behind, cold cyan eyes |
| `vaktmastare` | Spitter | purple coat, swollen green throat sac that swells before the spit |
| `sparkcykel` | Charger | dark teal brute in scrap plate, steel horns, shoulder spikes, orange eyes |
| `nattvakt` | The Warden | boss: red riot gear, cracked shield, baton, keyring |
| `chauffor` | The Conductor | boss: amber uniform, ticket machine on the chest, giant ticket punch |

Boss banners and the revive/horn lines are in `src/sim` event text: THE WARDEN, THE CONDUCTOR, NOT TODAY (revive), BUS IS READY (horn).

## Currency and material terms (the one real naming decision)

| Old | Now | Why |
|---|---|---|
| Biljetter (persistent) | **scrap** | the v3 save already migrates Biljetter to Scrap 1:1 |
| Växel (in-run coin, the `change` orb) | **scrap** | the sim already books it as `materials.scrap`; one word, one icon |
| Kuren (menu hub) | the bus | the hub becomes the bus in the design; menu.ts is #16's |
| Daglåda | daily crate | |
| Nattkort | night pass | the VIP pass |

Flag for the merger: the HUD, summary and menu (#16) still say Växel / Biljetter / BRÄNSLE until that ticket lands, and `src/ui/menu.ts` still carries the SISTA BUSSEN title. They should use "scrap", "fuel" and ZOMBUS.

## Branding

Title and manifest name: **ZOMBUS** (working name, not the store name; see the design doc). The repo, domain and save keys keep `sista-bussen`.
