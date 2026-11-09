# #17 zombie reskin: notes (w17-reskin)

Branch `totto/17-reskin`, worktree `/Users/vasthavm/Code/Worktrees-dsf/17-reskin`, HEAD `ca92cc8`
(81d75b3 checkpoint, fa43fc6 merge of totto/v2 @ 4e769a9, ca92cc8 post-merge fixes).

## Gates (state at ca92cc8)
- `npm run build`: green.
- `npm test`: 168/168 green (includes tests/english.test.ts).
- e2e: NOT run in full. Held by Totto (audio, Max in a meeting). Last run, coldopen.spec on chromium: test 2 (skip) passed,
  test 1 timed out because the Swedish first-run intro card (menu.ts, #16) covers the fresh menu and blocked the Settings click.
  Fixed in the spec (closes `[data-screen="intro"] button` first). Fix is unverified in a browser.
- `npm run build:docker-check`: NOT run. Docker daemon is down (socket missing).
- Not yet captured: screenshots/07-menu-375x667.png and 08-combat-375x667.png (tests/e2e/reskin.spec.ts writes them).

## AC status
1. Names/descriptions English in content.ts string fields only: done. Full list in specs/design/names-v2.md.
2. Zombie visuals: done in src/render (zombies.ts, pickups.ts, objective.ts bus, gallery.ts). Gallery screenshot screenshots/06-gallery.png
   was viewed before the merge; regenerate after the e2e hold lifts.
3. English UI copy: done for shop, crate, contracts, settings, levelup, adOverlay, updates, index.html, manifest, sw.js, icons.
   Not done, by Totto's scope: menu.ts, hud.ts, summary.ts, main.ts, game.ts, route.ts, catalog.ts (#16). Allowlisted in tests/english.test.ts.
4. Cold open: src/ui/intro.ts + coldopen.css, 4 frames, skippable, once, replay from Settings. Browser proof pending.
5. Swedish check: tests/english.test.ts, fails on injected Swedish (verified), allowlist honesty check included.
6. Screenshots: 07-coldopen-1/3/4.png exist (earlier run). Menu and combat pending.

## Open risks
- The menu intro card is Swedish and its ad line is #16's. `buildIntroCard` in src/ui/intro.ts is the English version
  with the #9-gate-correct ad line; #16 should swap it in and delete the allowlist entries.
- update.spec opens Settings via the Swedish nav label INSTALLNINGAR, which #16 will rename.
