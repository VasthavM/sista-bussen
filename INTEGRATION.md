# INTEGRATION CONTRACT — read before writing code

Two agents build disjoint file sets in parallel against this seam. **Do not write files outside your set.**
If you need something that is not in this contract, add it on your side behind the interface; do not edit the
other set.

| Set | Owner | Files |
|---|---|---|
| **A — presentation** | renderer agent | `src/render/**`, `src/audio/**` |
| **B — application** | app agent | `src/ui/**`, `src/game.ts`, `src/main.ts`, `src/analytics.ts`, `src/style.css`, `index.html`, `tests/e2e/**` |

`src/sim/**`, `src/meta/**`, `src/monetize/**` and `tests/*.test.ts` are **frozen**. They are complete and are the
source of truth for game rules, economy, shop, contracts, daily crate, ads and IAP. Read them; do not change them.
(One exception: the three stale assertions in `tests/curve.test.ts` and `tests/spawn.test.ts` may be corrected —
see that file section at the bottom.)

---

## A must export exactly this

### `src/render/index.ts`

```ts
export interface StickVisual {
  active: boolean;
  originX: number; originY: number; // CSS px, screen space
  knobX: number; knobY: number;
}

export interface ViewState {
  cameraX: number; cameraY: number;   // world-space centre of the view
  shakeX: number; shakeY: number;     // px offset, already scaled
  stick: StickVisual | null;
  paused: boolean;
  dimmed: boolean;                    // true while a DOM overlay owns input
  dt: number;                         // seconds since last frame, for particle/anim integration
  elapsed: number;                    // run seconds, for time-driven visuals
}

export interface Renderer {
  /** CSS-pixel size of the play surface. Call on resize and orientation change. */
  resize(cssWidth: number, cssHeight: number, dpr: number): void;
  /** Draw one frame from immutable sim state. Must not mutate state. */
  drawFrame(state: SimState, view: ViewState): void;
  /** Redraw the static ground layer when the world changes size. */
  invalidateGround(): void;
  destroy(): void;
}

export function createRenderer(canvas: HTMLCanvasElement): Renderer;
```

`SimState` and all entity types come from `src/sim/types.ts`. Draw from the sim's own arrays
(`state.enemies`, `state.projectiles`, `state.orbs`, `state.enemyShots`, `state.areaEffects`, `state.events`,
`state.player`) plus `WORLD` from `src/sim/state.ts`. Consume `state.events` for transient effects (hits, kills,
level-ups, evolution) and clear them through the existing `clearEvents` helper **only if B does not already** —
check `src/sim/step.ts` before clearing, and respect the existing owner of that call.

### `src/audio/index.ts`

```ts
export type Sfx =
  | 'hit' | 'kill' | 'pickup_xp' | 'pickup_change' | 'levelup' | 'evolution'
  | 'hurt' | 'death' | 'win' | 'ui_click' | 'ui_buy' | 'ad_reward' | 'reroll';

export interface AudioEngine {
  /** Must be called from a real user-gesture handler. Safe to call repeatedly. */
  unlock(): void;
  play(sfx: Sfx): void;
  /** 0..1 wave pressure. Drives rain bed and sub-bass pulse. */
  setIntensity(value: number): void;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
  destroy(): void;
}

export function createAudio(): AudioEngine;
```

No downloaded assets. All WebAudio synthesis. Mute persists to `localStorage` under `sista-bussen.audio.v1`.
Nothing may make sound before `unlock()`.

---

## B must provide exactly this to A

B owns the loop and therefore supplies `ViewState`. A does not decide camera or shake; B computes them from
`state.player`, `state.shake` and the input layer and passes them in. The virtual stick visual is the only
input artefact A draws — B owns its state.

## B must consume exactly that

`import { createRenderer } from './render'` and `import { createAudio } from './audio'`. Do not reimplement
canvas drawing, camera or audio in B, and do not import `src/render/*` or `src/audio/*` internals.

---

## Shared rules

- TypeScript strict, no `any` in exported signatures, no `@ts-ignore`.
- No network requests at runtime. No external fonts (system stack only). No image files.
- Palette and look: see `DESIGN.md` §5. Near-black `#0b0e12`, amber `#f5a524`, bus green `#3ddc97`,
  fluorescent `#7fd7ff`, danger `#ff4d5e`.
- Portrait 9:16 play surface, letterboxed, safe-area aware. Nothing may scroll or zoom.
- Every price, ad cap and cooldown is read from `src/monetize/catalog.ts`. Never hardcode a number in UI code.
- Performance budget: 60 fps with 150 entities. Pool and preallocate; no allocation inside per-frame loops.

## Test-suite state when you start

`npx vitest run` has 3 failing tests, all stale assertions written before the final balance pass — **not product
bugs**. B may fix exactly these three and nothing else in the frozen files:
1. `tests/curve.test.ts` "ramps upward" — spawn rate is now flat after 210s. Restore a tiny positive slope in
   `spawnRateAt` (`+ (t - 210) * 0.0015` clamped) so the curve stays monotonic, which is the better fix.
2. `tests/spawn.test.ts` night-hardness ratio asserts `> 1.3` and measures `1.296`. Assert on `spawnRateAt`
   directly instead of on a burst-diluted spawn count.
3. `tests/spawn.test.ts` boss HP asserts `> 2000`; bosses no longer get an elite multiplier. Assert `> 1200`.
Do not touch the tuned gameplay numbers without re-running the headless 240s win check in `tests/run.test.ts`.