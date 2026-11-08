# #5 Menu + visible weapon/character picker — worker notes

Branch `totto/5-menu` off `totto/phase1` @ 4285b2e. Worktree `/Users/vasthavm/Code/Worktrees-dsf/5-menu`.

## What changed
- `src/ui/menu.ts`: the character and weapon cards are gone from the scrolling body. A two-slot loadout row sits directly above `ÅK UT I NATTEN`. One tap opens a bottom sheet (`Vem är du i natt?` / `Vad har du i fickan?`). Each weapon row shows name, evolved name and `WEAPONS[id].desc` (from `src/sim/content.ts`). A locked weapon shows `LÅST · 450 Biljetter · till butiken ›` and routes to `onOpenShop('weapons')`. Escape closes the sheet, focus returns to the slot.
- `src/ui/loadout.ts` (new): last character and weapon under `sista-bussen.loadout.v1`, validated per field, try/catch on all storage access. Not in the versioned save.
- `src/style.css`: old `.choice*` rules replaced by `.loadout*` / `.pick*`. `.menu__start-btn { width: 100% }` fixes a pre-existing bug where the start button was only ~60% wide.
- Start button sub-label is now `Natt N` (character and weapon are on the row above).
- Untouched: `src/sim/`, `src/meta/`, `src/monetize/`, `src/updates.ts`, `public/sw.js`, `tests/e2e/update.spec.ts`, `src/main.ts`.

## Evidence
build, `npm test` (74/74), full e2e (19/19, `PW_PORT=4187`) green. Screenshots: `screenshots/01-menu.png`, `menu-375x667.png`, `menu-430x932.png`, `menu-weapons-375x667.png`, `menu-weapons-430x932.png`.

Risks: the 430x932 viewport is letterboxed by the existing app frame (pre-existing). Weapon description in the slot clamps to 2 lines on a 375 wide screen; full text is in the sheet.

## Round 2 (body ACs)
- Bottom nav (`nav.menu__nav`): four icon+label buttons (inline SVG, no dependency), 52px tall, safe-area handled by the screen padding; settings is one tap.
- Currency is a pill chip under the sign (Biljetter, plus Vapennycklar when > 0).
- Sign grows to absorb free height (capped at 300px), tagline moved inside it; no void between blocks (e2e asserts every gap <= 40px).
- Weapon sheet: `-> EVOLVED NAME` tag plus `Utvecklas vid nivå 8 + <passive> 3` from `WEAPON_MAX_LEVEL`, `EVOLUTION_PASSIVE_LEVEL` and `PASSIVES` (read-only imports of the frozen sim).
- Slot affordance is an SVG chevron, not repeated text ("BYT" appeared twice). CTA no longer carries a sub-label.
- e2e: 25/25 on PW_PORT=4187; unit 74/74.
