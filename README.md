# SISTA BUSSEN

A survivor-like mobile web game. One thumb, four minutes, one goal: stay alive until the last bus
arrives at 03:00.

Swedish, darkly funny, playable in a queue. Portrait mobile first, keyboard on desktop for testing.

- Design and monetization spec: [`DESIGN.md`](DESIGN.md)
- Build contracts between the layers: [`INTEGRATION.md`](INTEGRATION.md)

## Run it

```bash
npm install
npm run dev        # local dev server
npm run build      # typecheck + production bundle
npm run preview    # serve the built bundle
```

## Deploy

Live on Max's own Coolify server (VPS2), project `Sista Bussen`, application `sista-bussen`,
build pack `dockerfile`. The `Dockerfile` builds with `npm ci && npm run build` and serves `dist/` from
nginx; `docker/nginx.conf` owns the caching and content-type rules (service worker and manifest are
`no-cache`, `/assets/` is immutable, `.webmanifest` is served as `application/manifest+json`).

Temporary host, because the subdomain has no DNS record yet:

```
https://q1khvfvk2w9tho9rc5psbhxx.187.124.132.205.sslip.io
```

To move it to `sista-bussen.vasthavm.com`: add `A sista-bussen` → `187.124.132.205` at the DNS provider,
change the application's domain in Coolify to `https://sista-bussen.vasthavm.com`, redeploy, and let
Traefik issue the certificate.

Deploys are manual: push to `main`, then trigger a deploy in Coolify. Coolify's `static` build pack does
**not** work for this repo — it copies pre-built files and never runs `npm run build`, and `dist/` is
gitignored. Keep the Dockerfile path.

Smoke-check a deployment before handing out a URL:

```bash
H=<host> node tools/live-check.mjs   # boots the game on an iPhone viewport, asserts no console
                                     # errors, no failed requests, canvas present, SW active
```

## Play

- **Move:** drag anywhere on screen — a floating stick appears under your thumb. Desktop: WASD or arrows.
- **Attack:** automatic. You never aim.
- **Goal:** survive from 23:00 to 03:00. The `Nattvakten` arrives at 02:30, the `Busschauffören` at 02:45,
  and the bus at 03:00.
- **Pause:** `Esc` or `P`, or the pause button.
- **Level up:** pick one of three cards. Weapons evolve when the base weapon reaches level 8 *and* its named
  passive reaches level 3.
- **Death:** the bus is delayed. You can revive twice per run via a rewarded ad, and double your fares once.
- **Meta:** fares convert to Biljetter in the Kuren shop, which buys permanent power for the next night.

## Architecture

```
src/sim/         deterministic, headless game simulation (no DOM, no canvas, no clock)
src/render/      canvas 2D renderer: ground, entities, weapons, particles, post
src/audio/       WebAudio synthesis, no audio assets
src/ui/          DOM overlays: menu, level-up, summary, shop, contracts, crate, settings
src/meta/        save, economy, shop, contracts, daily crate
src/monetize/    ad and IAP provider interfaces, catalog, frequency guards
src/game.ts      run orchestration, fixed-timestep loop, input, hitstop
src/main.ts      boot, router, provider wiring, debug API
tests/           vitest unit tests, playwright e2e
tools/gallery.mjs  sprite evidence shot -> screenshots/06-gallery.png
tools/icons.mjs    home-screen icon set -> public/icon-*.png, apple-touch-icon.png
```

The simulation is deliberately isolated: it takes a seed and an input vector and produces state. That is why
the unit tests can run a full 240-second night headlessly and assert the win condition, and why balance
changes can be checked without opening a browser.

## Where to change things

| What | Where |
|---|---|
| Difficulty, spawn curve, XP curve, boss timings | `src/sim/curve.ts` |
| Weapons, passives, evolutions, characters, enemies | `src/sim/content.ts` |
| Shop upgrades, unlock costs, cosmetic colours | `src/meta/shop.ts` |
| Contract templates, daily crate rewards | `src/meta/contracts.ts`, `src/meta/daily.ts` |
| Ad placements, caps, cooldowns, every price in SEK | `src/monetize/catalog.ts` |
| Visual palette, sprite paint tables | `src/render/palette.ts` |

Rule: no price, cap or cooldown is ever written in UI code. It comes from `src/monetize/catalog.ts`.
That is enforced by the money-loop e2e test.

## Ads and purchases

`src/monetize/ads.ts` defines `AdProvider` and `IapProvider` with mock implementations: the ad is a 1.2-second
countdown overlay, purchases resolve immediately. To go live, implement those two interfaces against a real
SDK and pass them in `src/main.ts` — no other file needs to change.

The interstitial guard is a pure function, `shouldShowInterstitial`, unit tested. It refuses to fire during a
run, on the first run, more than once per three runs, or within 90 seconds of the previous one. Rewarded ads
are always player-initiated and always show what the reward is before the player commits.

## Tests

```bash
npm test              # 59 unit tests: curves, spawn, upgrades, economy, save, ads, full-run win check
npx playwright test   # 2 e2e specs: boot/play/level-up, and revive/double-fares/shop/next-run
node tools/gallery.mjs  # regenerate the sprite sheet at screenshots/06-gallery.png
node tools/icons.mjs    # regenerate the install icons in public/ (PNGs + vector favicon)
```

Screenshots in `screenshots/` are test artifacts, regenerated by the e2e suite. They are committed on purpose:
they are the visual record of what the build actually renders.

## Install icons

The home-screen icons are generated, not hand-drawn binaries: `tools/icons.mjs` composes the bus-stop sign
artwork as SVG and rasterises it with the Playwright Chromium already installed as a devDependency.

```bash
node tools/icons.mjs    # writes public/icon-192.png, icon-512.png, icon-maskable-512.png,
                        # apple-touch-icon.png and the vector favicon
```

- `icon-192.png` / `icon-512.png` — `any`, referenced by `public/manifest.webmanifest`.
- `icon-maskable-512.png` — `maskable`; the artwork is scaled into the central 80% safe zone, the background
  stays full-bleed, so launchers can crop to a circle or squircle.
- `apple-touch-icon.png` — 180×180 and fully opaque. iOS ignores SVG icons and paints transparent pixels
  black, so this one has an opaque background.
- `public/sw.js` precaches all four plus the manifest and every hashed asset. The cache name is stamped at
  build time (version, SHA, asset hash), so changed artwork reaches installed clients without a manual bump.

Change the artwork in the generator, never by editing the PNGs.

## Save data

`localStorage` key `sista-bussen.save.v1`, versioned with forward migration and a corrupt-save fallback that
starts a fresh profile rather than crashing. Audio mute lives under `sista-bussen.audio.v1`.

## Known gaps

- Real ad and billing SDKs are not integrated; mocks only.
- Analytics has a typed event list and a console sink, no transport.
- Sprite art is procedural and stylized; characters read at in-game scale but are not hand-drawn.
- Night difficulty beyond night 3 is untuned by hand — it scales mechanically from `nightDifficulty`.