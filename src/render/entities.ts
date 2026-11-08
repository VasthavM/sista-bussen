/**
 * Flat vector silhouettes with a dark outline and a leading-edge rim light.
 *
 * Readability rules for this file:
 *  - Every character is a *person shape* first: coat, shoulder bar, arms, and a
 *    head that protrudes past the shoulder line, with a hand doing something.
 *    Limbs are tapered wedges, never round-capped tubes: tubes read as sausages
 *    at 40px.
 *  - Each silhouette is built from two tones of its own colour plus one prop
 *    colour, so the parts separate at sprite scale without extra detail.
 *  - Outer masses sit clear of the `#0b0e12` asphalt value and carry a ~1.4px
 *    dark outline, so they read as drawn figures rather than shadows.
 *  - Facing is legible from the sprite: face and crown lit on the leading edge,
 *    prop out front, bright rim only on that edge and only where nothing else
 *    is drawn on top of it.
 *  - Each enemy type states its behaviour: slumped and wide (walker), small and
 *    winged (swarm), hooded and trailing (shadow), square shouldered and armed
 *    (ranged), lean on a deck (charger), heavy with epaulettes (bosses).
 *  - A hit flash lightens the entity's own colours (see `ENEMY_PAINT` /
 *    `CHAR_PAINT` flash variants); it never paints over the dark outline, the
 *    face structure or the accent, so a flashing entity stays recognisable.
 *  - Anything that will hurt you telegraphs in red before it lands.
 *  - No gradients, no filters, no per-frame string building: every colour is
 *    precomputed in `palette.ts` and every path is drawn per frame.
 */
import { ENEMIES } from '../sim/content';
import type { CharacterId, Enemy, EnemyType } from '../sim/types';
import type { Draw } from './draw';
import { visible } from './draw';
import { CHAR_ART, CHAR_PAINT, ENEMY_ART, ENEMY_PAINT, PAL, WEAPON_LOOK } from './palette';
import type { SpritePaint } from './palette';
import { drawGlow, glowSprite } from './sprites';

const TAU = Math.PI * 2;
const DASH = [9, 7];
const NO_DASH: number[] = [];

/* --- drawing primitives -------------------------------------------------- */

/**
 * Seal an already-built path: wide dark stroke first, fill on top. The visible
 * result is a clean outer edge of `ol` px around the union of the sub-paths,
 * with no seams where the parts of one silhouette meet.
 */
function seal(
  ctx: CanvasRenderingContext2D,
  fill: string,
  outline: string,
  ol: number,
): void {
  ctx.strokeStyle = outline;
  ctx.lineWidth = ol * 2;
  ctx.stroke();
  ctx.fillStyle = fill;
  ctx.fill();
}

/**
 * Tapered limb: a four-point wedge from a wide root to a narrow end. Outlined
 * like every other mass. A round-capped tube of the same width reads as a
 * sausage; a wedge reads as an arm.
 */
function taper(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  w0: number,
  w1: number,
  fill: string,
  outline: string,
  ol: number,
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  ctx.beginPath();
  ctx.moveTo(x0 + nx * w0, y0 + ny * w0);
  ctx.lineTo(x1 + nx * w1, y1 + ny * w1);
  ctx.lineTo(x1 - nx * w1, y1 - ny * w1);
  ctx.lineTo(x0 - nx * w0, y0 - ny * w0);
  ctx.closePath();
  seal(ctx, fill, outline, ol);
}

/** Flat plate: straps, cap peaks, hazard bands, deck plates. */
function plate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  fill: string,
  outline: string,
  ol: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  seal(ctx, fill, outline, ol);
}

function disc(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rad: number,
  fill: string,
): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, rad, 0, TAU);
  ctx.fill();
}

function discSolid(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rad: number,
  fill: string,
  outline: string,
  ol: number,
): void {
  ctx.beginPath();
  ctx.arc(x, y, rad, 0, TAU);
  seal(ctx, fill, outline, ol);
}

/**
 * Head at the leading edge: lit face, crown (hair, hood, cap) over the rear,
 * dark eye, bright rim on the front arc. A bare bright disc reads as a ball;
 * this reads as a head with a direction.
 */
function headMass(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rad: number,
  p: SpritePaint,
  crown: string,
  band: string | null,
  inv: number,
): void {
  discSolid(ctx, x, y, rad, p.head, p.outline, 1.1 * inv);
  // Crown over the rear of the head only: the lit face has to survive.
  ctx.beginPath();
  ctx.arc(x - rad * 0.14, y, rad * 0.98, Math.PI * 0.6, Math.PI * 1.4);
  ctx.closePath();
  ctx.fillStyle = crown;
  ctx.fill();
  // Cap band along the crown edge: reads as a cap without covering the face.
  if (band !== null) {
    ctx.beginPath();
    ctx.arc(x - rad * 0.14, y, rad * 0.99, Math.PI * 0.6, Math.PI * 1.4);
    ctx.strokeStyle = band;
    ctx.lineWidth = 1.6 * inv;
    ctx.stroke();
  }
  disc(ctx, x + rad * 0.42, y - rad * 0.1, rad * 0.15, p.outline);
  // Rim inside the head, front arc only: no bright hook outside the silhouette.
  ctx.beginPath();
  ctx.arc(x, y, rad * 0.86, -0.62, 0.62);
  ctx.strokeStyle = p.rim;
  ctx.lineWidth = 1.3 * inv;
  ctx.stroke();
}

function enemyPaintFor(type: EnemyType, flash: boolean): SpritePaint {
  const states = ENEMY_PAINT[type];
  return flash ? states.flash : states.normal;
}

function facingOf(d: Draw, e: Enemy): number {
  const st = d.state;
  // Chargers and throwers aim where the sim will aim: at the player. Reading
  // the velocity here would point the wind-up at a stale/zeroed direction,
  // which is exactly the "unfair hit" case.
  if (e.type === 'sparkcykel' && e.state === 1) {
    return Math.atan2(st.player.y - e.y, st.player.x - e.x);
  }
  if (e.type === 'vaktmastare' && e.timer > 0 && e.timer < 0.55) {
    return Math.atan2(st.player.y - e.y, st.player.x - e.x);
  }
  if (e.vx * e.vx + e.vy * e.vy > 4) return Math.atan2(e.vy, e.vx);
  return e.phase;
}

/** Grounding shadows, batched into a single path and single fill. */
export function drawShadows(d: Draw): void {
  const ctx = d.ctx;
  const st = d.state;
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.beginPath();
  for (let i = 0; i < st.enemies.length; i++) {
    const e = st.enemies[i];
    if (e.hp <= 0 || !visible(d, e.x, e.y, 60)) continue;
    ctx.ellipse(e.x + 3, e.y + e.radius * 0.55, e.radius * 1.05, e.radius * 0.5, 0, 0, TAU);
  }
  const p = st.player;
  const pr = 15;
  ctx.ellipse(p.x + 3, p.y + pr * 0.55, pr * 1.1, pr * 0.52, 0, 0, TAU);
  ctx.fill();
}

function eliteAura(ctx: CanvasRenderingContext2D, e: Enemy, d: Draw): void {
  if (!e.elite) return;
  drawGlow(ctx, glowSprite(PAL.amber), e.x, e.y, e.radius * 2.4, 0.3);
  ctx.strokeStyle = ENEMY_ART[e.type].rimSoftStroke;
  ctx.lineWidth = 1.5 * d.inv;
  ctx.beginPath();
  ctx.arc(e.x, e.y, e.radius * 1.25, 0, TAU);
  ctx.stroke();
}

function healthBar(ctx: CanvasRenderingContext2D, e: Enemy, d: Draw): void {
  const boss = e.type === 'nattvakt' || e.type === 'chauffor';
  if (!e.elite && !boss) return;
  const w = e.radius * 1.9;
  const h = 3 * d.inv;
  const y = e.y - e.radius * 1.6;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(e.x - w / 2, y, w, h);
  const frac = Math.max(0, Math.min(1, e.hp / Math.max(1, e.maxHp)));
  ctx.fillStyle = boss ? PAL.danger : PAL.amber;
  ctx.fillRect(e.x - w / 2, y, w * frac, h);
}

/* --- per-type silhouettes. All are drawn in a local space facing +x. ----- */

/**
 * Walker. Coat slumped back, shoulder bar dropped to one side, head hanging
 * forward at ~0.9r so it breaks the silhouette, dark neck gap, and a bottle arm
 * reaching past the body.
 */
function drawFyllo(ctx: CanvasRenderingContext2D, e: Enemy, d: Draw, flash: boolean): void {
  const art = ENEMY_ART.fyllo;
  const p = enemyPaintFor('fyllo', flash);
  const r = e.radius;
  const inv = d.inv;
  ctx.rotate(Math.sin(d.t * 3.4 + e.phase) * 0.09);

  // Coat, dragged back and down: the slump.
  ctx.beginPath();
  ctx.moveTo(0.26 * r, -0.52 * r);
  ctx.lineTo(-0.6 * r, -0.68 * r);
  ctx.lineTo(-0.92 * r, 0.14 * r);
  ctx.lineTo(-0.5 * r, 0.74 * r);
  ctx.lineTo(0.18 * r, 0.64 * r);
  ctx.lineTo(0.34 * r, 0.14 * r);
  ctx.closePath();
  seal(ctx, p.shell, p.outline, 1.4 * inv);

  // Shoulder bar: the cross that says "person" from above, dropped to one side.
  plate(ctx, -0.16 * r, -0.66 * r, 0.46 * r, 1.28 * r, 0.1 * r, p.body, p.outline, 1.2 * inv);

  // Rear arm hanging behind.
  taper(ctx, -0.16 * r, 0.4 * r, -0.56 * r, 0.72 * r, 0.13 * r, 0.08 * r, p.shell, p.outline, 1 * inv);

  // Bottle arm, out past the coat.
  taper(ctx, 0.16 * r, 0.42 * r, 0.9 * r, 0.5 * r, 0.13 * r, 0.07 * r, p.body, p.outline, 1 * inv);
  discSolid(ctx, 0.96 * r, 0.5 * r, 0.12 * r, p.head, p.outline, 0.9 * inv);

  // Bottle, held clear of the body.
  ctx.save();
  ctx.translate(1.2 * r, 0.62 * r);
  ctx.rotate(0.34);
  plate(ctx, -0.13 * r, -0.22 * r, 0.26 * r, 0.48 * r, 0.05 * r, p.kit, p.outline, 0.9 * inv);
  plate(ctx, -0.055 * r, -0.36 * r, 0.11 * r, 0.16 * r, 0.02 * r, p.kitDeep, p.outline, 0.8 * inv);
  ctx.restore();

  // Neck gap, then the head at ~0.9r.
  taper(ctx, 0.3 * r, -0.02 * r, 0.62 * r, -0.14 * r, 0.15 * r, 0.13 * r, p.outline, p.outline, 0);
  headMass(ctx, 0.94 * r, -0.18 * r, 0.3 * r, p, p.headDeep, null, inv);
  // Hallucinating eye, in the accent: this is what survives the flash.
  disc(ctx, 1.12 * r, -0.26 * r, 0.06 * r, art.look.accent);
}

/**
 * Fast swarm. One mid-tone bird mass (body, wings and tail share a fill), dark
 * wingtips, bright beak and a bright eye. Broad swept wings and a notched fan
 * tail keep it from reading as a paper dart.
 */
function drawDuva(ctx: CanvasRenderingContext2D, e: Enemy, d: Draw, flash: boolean): void {
  const art = ENEMY_ART.duva;
  const p = enemyPaintFor('duva', flash);
  const r = e.radius;
  const inv = d.inv;
  const flap = Math.sin(d.t * 17 + e.phase);
  const up = 1 + flap * 0.22;

  // At an 18px world footprint only one wing can be drawn without the bird
  // turning into a fan of spikes. A short single-point tail plus one raised
  // wing and one dark tucked wing gives an asymmetric read: bird, not debris.
  ctx.beginPath();
  ctx.moveTo(-0.4 * r, -0.18 * r);
  ctx.lineTo(-0.92 * r, 0);
  ctx.lineTo(-0.4 * r, 0.18 * r);
  ctx.closePath();
  seal(ctx, p.body, p.outline, 1 * inv);

  // Far wing, tucked and in shadow: small, behind the body.
  ctx.beginPath();
  ctx.moveTo(0.3 * r, 0.08 * r);
  ctx.lineTo(0.02 * r, 0.62 * r);
  ctx.lineTo(-0.34 * r, 0.5 * r);
  ctx.lineTo(-0.14 * r, 0.08 * r);
  ctx.closePath();
  seal(ctx, p.shade, p.outline, 0.9 * inv);

  // Near wing, raised: one clean wedge with a lit leading edge.
  ctx.beginPath();
  ctx.moveTo(0.3 * r, -0.06 * r);
  ctx.lineTo(0.08 * r, -1.08 * r * up);
  ctx.lineTo(-0.56 * r, -0.8 * r * up);
  ctx.lineTo(-0.2 * r, -0.08 * r);
  ctx.closePath();
  seal(ctx, p.body, p.outline, 1 * inv);
  ctx.beginPath();
  ctx.moveTo(0.3 * r, -0.06 * r);
  ctx.lineTo(0.08 * r, -1.08 * r * up);
  ctx.strokeStyle = p.rim;
  ctx.lineWidth = 1.1 * inv;
  ctx.stroke();

  // Body, then the head, beak and eye.
  ctx.beginPath();
  ctx.ellipse(0.08 * r, 0, 0.42 * r, 0.26 * r, 0, 0, TAU);
  seal(ctx, p.body, p.outline, 1 * inv);
  discSolid(ctx, 0.52 * r, 0, 0.23 * r, p.body, p.outline, 1 * inv);
  ctx.beginPath();
  ctx.moveTo(0.68 * r, -0.09 * r);
  ctx.lineTo(0.96 * r, 0);
  ctx.lineTo(0.68 * r, 0.09 * r);
  ctx.closePath();
  ctx.fillStyle = p.kit;
  ctx.fill();
  disc(ctx, 0.56 * r, -0.09 * r, 0.1 * r, p.shade);
  disc(ctx, 0.58 * r, -0.11 * r, 0.05 * r, art.look.accent);
  ctx.beginPath();
  ctx.arc(0.52 * r, 0, 0.24 * r, -0.8, 0.8);
  ctx.strokeStyle = p.rim;
  ctx.lineWidth = 1.3 * inv;
  ctx.stroke();
}

/**
 * Erratic shadow. A hooded wisp with a masked face: two cold eyes behind a dark
 * plate, a torn trail behind. Low mass on purpose, but never below the asphalt
 * value and never without a direction.
 */
function drawSkugga(ctx: CanvasRenderingContext2D, e: Enemy, d: Draw, flash: boolean): void {
  const art = ENEMY_ART.skugga;
  const p = enemyPaintFor('skugga', flash);
  const r = e.radius;
  const inv = d.inv;
  const wob = Math.sin(d.t * 2.6 + e.phase) * 0.16 * r;

  // Trail: three torn wisps behind the body.
  ctx.save();
  ctx.strokeStyle = p.body;
  ctx.lineWidth = 2 * inv;
  for (let i = 0; i < 3; i++) {
    const off = (i - 1) * 0.28 * r;
    ctx.globalAlpha = 0.3 - i * 0.05;
    ctx.beginPath();
    ctx.moveTo(-0.5 * r, off * 0.4);
    ctx.quadraticCurveTo(-1.1 * r, off + wob, -1.7 * r - i * 0.2 * r, off * 0.3);
    ctx.stroke();
  }
  ctx.restore();

  // Body: hood mass with a torn hem, one fill.
  ctx.beginPath();
  ctx.moveTo(0.78 * r, -0.2 * r);
  ctx.quadraticCurveTo(0.86 * r, -0.42 * r, 0.5 * r, -0.42 * r);
  ctx.lineTo(-0.5 * r, -0.26 * r);
  ctx.lineTo(-0.34 * r, -0.06 * r);
  ctx.lineTo(-0.62 * r, 0.08 * r);
  ctx.lineTo(-0.4 * r, 0.24 * r);
  ctx.quadraticCurveTo(0.4 * r, 0.44 * r, 0.78 * r, 0.2 * r);
  ctx.closePath();
  seal(ctx, p.body, p.outline, 1.2 * inv);

  // Hood over the back of the head and a dark face plate.
  ctx.beginPath();
  ctx.arc(0.5 * r, 0, 0.4 * r, Math.PI * 0.5, Math.PI * 1.5);
  ctx.closePath();
  ctx.fillStyle = p.shell;
  ctx.fill();
  disc(ctx, 0.56 * r, 0, 0.28 * r, p.shade);

  // Two cold eyes on the plate are the whole read.
  ctx.fillStyle = art.head;
  ctx.fillRect(0.5 * r, -0.2 * r, 0.22 * r, 0.1 * r);
  ctx.fillRect(0.5 * r, 0.1 * r, 0.22 * r, 0.1 * r);
  // Rim, leading edge only.
  ctx.beginPath();
  ctx.arc(0.5 * r, 0, 0.4 * r, -0.85, 0.85);
  ctx.strokeStyle = p.rim;
  ctx.lineWidth = 1.4 * inv;
  ctx.stroke();
}

/**
 * Ranged attacker. Upright square shoulders, hi-vis bands, peaked cap and a
 * broom held out front. In the half second before it throws, the arm lifts and a
 * red fan appears exactly where the cones will go.
 */
function drawVaktmastare(
  ctx: CanvasRenderingContext2D,
  e: Enemy,
  d: Draw,
  flash: boolean,
): void {
  const art = ENEMY_ART.vaktmastare;
  const p = enemyPaintFor('vaktmastare', flash);
  const r = e.radius;
  const inv = d.inv;
  const winding = e.timer > 0 && e.timer < 0.55;

  if (winding) {
    const k = 1 - e.timer / 0.55;
    ctx.save();
    ctx.globalAlpha = 0.16 + 0.26 * k;
    ctx.fillStyle = art.telegraph;
    ctx.beginPath();
    ctx.moveTo(r * 0.4, 0);
    ctx.arc(r * 0.4, 0, r * 6.2, -0.44, 0.44);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.35 + 0.5 * k;
    ctx.strokeStyle = art.telegraph;
    ctx.lineWidth = 2 * d.inv;
    for (let i = -1; i <= 1; i++) {
      const a = i * 0.22;
      ctx.beginPath();
      ctx.moveTo(r * 0.6, 0);
      ctx.lineTo(r * 0.6 + Math.cos(a) * r * 6.2, Math.sin(a) * r * 6.2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Uniform coat: wide at the shoulders, hard hem, neck notch. A narrow slab
  // with a face inside reads as a badge; the shoulder span makes it a person.
  ctx.beginPath();
  ctx.moveTo(0.3 * r, -0.56 * r);
  ctx.lineTo(-0.52 * r, -0.7 * r);
  ctx.lineTo(-0.58 * r, 0.68 * r);
  ctx.lineTo(0.24 * r, 0.6 * r);
  ctx.closePath();
  seal(ctx, p.shell, p.outline, 1.4 * inv);

  // Shoulder bar, then two arms: broom arm forward, other arm at the side.
  plate(ctx, -0.2 * r, -0.76 * r, 0.5 * r, 1.52 * r, 0.12 * r, p.body, p.outline, 1.1 * inv);
  const by = winding ? -0.8 * r : 0.44 * r;
  taper(ctx, 0.14 * r, 0.44 * r, 0.64 * r, by, 0.15 * r, 0.09 * r, p.body, p.outline, 1 * inv);
  taper(ctx, 0.1 * r, -0.46 * r, 0.42 * r, -0.74 * r, 0.13 * r, 0.08 * r, p.body, p.outline, 1 * inv);

  // Hi-vis bands across the back: the type signature, read as two bars.
  plate(ctx, -0.44 * r, -0.34 * r, 0.46 * r, 0.12 * r, 0.03 * r, p.kit, p.outline, 0.6 * inv);
  plate(ctx, -0.44 * r, 0.2 * r, 0.46 * r, 0.12 * r, 0.03 * r, p.kit, p.outline, 0.6 * inv);
  // Belt.
  plate(ctx, -0.5 * r, 0.56 * r, 0.66 * r, 0.09 * r, 0.02 * r, p.shade, p.outline, 0);

  // Peaked cap: crown from headMass, peak projecting past the head.
  headMass(ctx, 0.8 * r, 0, 0.26 * r, p, p.hatDeep, p.detail, inv);
  ctx.beginPath();
  ctx.moveTo(0.98 * r, -0.2 * r);
  ctx.lineTo(1.3 * r, -0.04 * r);
  ctx.lineTo(1.3 * r, 0.05 * r);
  ctx.lineTo(0.98 * r, 0.16 * r);
  ctx.closePath();
  seal(ctx, p.hatDeep, p.outline, 0.9 * inv);

  // Broom, from the hand out front, or lifted for the throw.
  taper(ctx, 0.62 * r, by, 1.7 * r, by * 1.08, 0.045 * r, 0.038 * r, PAL.steel, p.outline, 0.5 * inv);
  ctx.beginPath();
  ctx.moveTo(1.64 * r, by * 1.08 - 0.24 * r);
  ctx.lineTo(2.0 * r, by * 1.08 - 0.06 * r);
  ctx.lineTo(2.0 * r, by * 1.08 + 0.22 * r);
  ctx.lineTo(1.64 * r, by * 1.08 + 0.3 * r);
  ctx.closePath();
  seal(ctx, p.kit, p.outline, 0.9 * inv);
}

/** Wheel: dark tyre, bright hub. Reads as a wheel, not a ring. */
function wheel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rad: number,
  tyre: string,
  hub: string,
  outline: string,
  ol: number,
): void {
  discSolid(ctx, x, y, rad, tyre, outline, ol);
  disc(ctx, x, y, rad * 0.4, hub);
}

/**
 * Charger. A rider leaning forward over the bars of a deck scooter with visible
 * wheels, then motion lines once it commits. The wind-up paints the lane it will
 * take, in red, from its own front wheel toward the player.
 */
function drawSparkcykel(
  ctx: CanvasRenderingContext2D,
  e: Enemy,
  d: Draw,
  flash: boolean,
): void {
  const art = ENEMY_ART.sparkcykel;
  const p = enemyPaintFor('sparkcykel', flash);
  const r = e.radius;
  const inv = d.inv;

  if (e.state >= 1) {
    const k = e.state === 1 ? 1 - e.timer / 1.1 : 1;
    const len = e.state === 2 ? 150 : 190;
    ctx.save();
    ctx.globalAlpha = e.state === 2 ? 0.42 : 0.28 + 0.45 * k;
    ctx.strokeStyle = art.telegraph;
    ctx.lineWidth = 2 * inv;
    ctx.setLineDash(DASH);
    ctx.beginPath();
    ctx.moveTo(r * 1.1, -r * 0.62);
    ctx.lineTo(len, -r * 0.62);
    ctx.moveTo(r * 1.1, r * 0.62);
    ctx.lineTo(len, r * 0.62);
    ctx.stroke();
    ctx.setLineDash(NO_DASH);
    // Chevrons pointing down the lane.
    for (let i = 0; i < 3; i++) {
      const x = r * 1.6 + i * (len - r * 1.6) * 0.34;
      ctx.beginPath();
      ctx.moveTo(x, -r * 0.34);
      ctx.lineTo(x + r * 0.44, 0);
      ctx.lineTo(x, r * 0.34);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (e.state === 2) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = p.kit;
    ctx.lineWidth = 2 * inv;
    for (let i = 0; i < 3; i++) {
      const off = (i - 1) * r * 0.5;
      ctx.beginPath();
      ctx.moveTo(-r * 1.1, off * 0.5);
      ctx.lineTo(-r * (1.9 + i * 0.25), off * 0.22);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Deck and wheels.
  plate(ctx, -0.98 * r, 0.42 * r, 1.94 * r, 0.24 * r, 0.08 * r, p.kitDeep, p.outline, 1.1 * inv);
  wheel(ctx, -0.8 * r, 0.62 * r, 0.24 * r, p.outline, p.kit, p.outline, 0.8 * inv);
  wheel(ctx, 0.78 * r, 0.62 * r, 0.24 * r, p.outline, p.kit, p.outline, 0.8 * inv);

  // Jacket tail behind: the lean.
  ctx.beginPath();
  ctx.moveTo(-0.18 * r, -0.26 * r);
  ctx.lineTo(-0.78 * r, -0.02 * r);
  ctx.lineTo(-0.24 * r, 0.26 * r);
  ctx.closePath();
  seal(ctx, p.shell, p.outline, 1 * inv);

  // Legs on the deck.
  taper(ctx, -0.04 * r, 0.2 * r, 0.16 * r, 0.44 * r, 0.11 * r, 0.08 * r, p.shade, p.outline, 0.8 * inv);
  taper(ctx, 0.16 * r, 0.44 * r, 0.4 * r, 0.5 * r, 0.08 * r, 0.06 * r, p.shade, p.outline, 0.8 * inv);

  // Torso, leaning forward over the bars.
  taper(ctx, -0.24 * r, 0.14 * r, 0.42 * r, -0.44 * r, 0.3 * r, 0.2 * r, p.body, p.outline, 1.2 * inv);
  // Arm to the bar.
  taper(ctx, 0.3 * r, -0.36 * r, 0.6 * r, -0.38 * r, 0.1 * r, 0.06 * r, p.body, p.outline, 0.8 * inv);

  // Stem and bars.
  taper(ctx, 0.78 * r, 0.56 * r, 0.62 * r, -0.32 * r, 0.05 * r, 0.04 * r, PAL.steel, p.outline, 0.5 * inv);
  plate(ctx, 0.34 * r, -0.4 * r, 0.4 * r, 0.08 * r, 0.03 * r, PAL.steel, p.outline, 0.4 * inv);

  // Head, helmet and face.
  discSolid(ctx, 0.64 * r, -0.52 * r, 0.22 * r, p.head, p.outline, 1 * inv);
  ctx.beginPath();
  ctx.arc(0.62 * r, -0.55 * r, 0.25 * r, Math.PI * 0.94, Math.PI * 2.0);
  ctx.closePath();
  seal(ctx, p.kit, p.outline, 0.9 * inv);
  disc(ctx, 0.78 * r, -0.5 * r, 0.055 * r, p.outline);

  // Head lamp on the deck front.
  disc(ctx, 0.92 * r, 0.54 * r, 0.08 * r, PAL.amberWarm);
}

/** Boss telegraph: the radial burst fires at 0.5s, so the ring starts before it. */
function burstTelegraph(
  ctx: CanvasRenderingContext2D,
  d: Draw,
  r: number,
  timer: number,
  colour: string,
): void {
  if (timer <= 0 || timer > 0.5) return;
  const k = 1 - timer / 0.5;
  ctx.save();
  ctx.globalAlpha = 0.22 + 0.3 * k;
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(0, 0, r * (1.0 + 0.3 * k), 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 0.5 + 0.5 * k;
  ctx.strokeStyle = colour;
  ctx.lineWidth = 3 * d.inv;
  ctx.beginPath();
  ctx.arc(0, 0, r * (1.05 + 0.55 * k), 0, TAU);
  ctx.stroke();
  ctx.restore();
}

/**
 * Boss 1. Imposing: a long dark coat, hard epaulettes wider than the shoulders, a
 * tall peaked cap and a lantern held out front. The shoulders and the crown are
 * the read.
 */
function drawNattvakt(ctx: CanvasRenderingContext2D, e: Enemy, d: Draw, flash: boolean): void {
  const art = ENEMY_ART.nattvakt;
  const p = enemyPaintFor('nattvakt', flash);
  const r = e.radius;
  const inv = d.inv;
  burstTelegraph(ctx, d, r, e.timer, art.telegraph);

  // Long coat.
  ctx.beginPath();
  ctx.moveTo(0.44 * r, -0.6 * r);
  ctx.lineTo(-0.78 * r, -0.72 * r);
  ctx.lineTo(-0.94 * r, 0.18 * r);
  ctx.lineTo(-0.74 * r, 0.84 * r);
  ctx.lineTo(0.26 * r, 0.8 * r);
  ctx.lineTo(0.46 * r, 0.4 * r);
  ctx.lineTo(0.46 * r, -0.4 * r);
  ctx.closePath();
  seal(ctx, p.shell, p.outline, 1.6 * inv);

  // Rim on the leading edge of the coat, before anything is drawn on top of it.
  ctx.beginPath();
  ctx.moveTo(0.44 * r, -0.58 * r);
  ctx.lineTo(0.44 * r, 0.38 * r);
  ctx.strokeStyle = p.rim;
  ctx.lineWidth = 1.6 * inv;
  ctx.stroke();

  // Shoulder bar: wide and bright, the size read.
  plate(ctx, -0.16 * r, -0.7 * r, 0.5 * r, 1.4 * r, 0.1 * r, p.body, p.outline, 1.4 * inv);

  // Epaulettes: flat plates that break the shoulder line outward.
  plate(ctx, -0.22 * r, -1.02 * r, 0.56 * r, 0.24 * r, 0.05 * r, p.shade, p.outline, 1.1 * inv);
  plate(ctx, -0.22 * r, 0.78 * r, 0.56 * r, 0.24 * r, 0.05 * r, p.shade, p.outline, 1.1 * inv);
  // Belt and buckle.
  plate(ctx, -0.6 * r, 0.12 * r, 0.94 * r, 0.12 * r, 0.03 * r, p.shade, p.outline, 0);
  disc(ctx, 0.06 * r, 0.18 * r, 0.075 * r, p.kit);

  // Arms: one to the lantern, one held back.
  taper(ctx, 0.12 * r, 0.5 * r, 0.76 * r, 0.74 * r, 0.16 * r, 0.1 * r, p.body, p.outline, 1 * inv);
  taper(ctx, 0.08 * r, -0.5 * r, 0.44 * r, -0.66 * r, 0.15 * r, 0.09 * r, p.body, p.outline, 1 * inv);

  // Peaked cap behind the face, visor over it, badge on the crown.
  discSolid(ctx, 0.4 * r, 0, 0.36 * r, p.hatDeep, p.outline, 1.2 * inv);
  headMass(ctx, 0.62 * r, 0, 0.24 * r, p, p.hatDeep, p.detail, inv);
  ctx.beginPath();
  ctx.moveTo(0.62 * r, -0.19 * r);
  ctx.lineTo(1.0 * r, -0.03 * r);
  ctx.lineTo(1.0 * r, 0.05 * r);
  ctx.lineTo(0.62 * r, 0.17 * r);
  ctx.closePath();
  ctx.fillStyle = p.hatDeep;
  ctx.fill();
  disc(ctx, 0.4 * r, 0, 0.07 * r, p.kit);

  // Lantern out front: warm light, threat direction.
  plate(ctx, 0.68 * r, 0.58 * r, 0.34 * r, 0.4 * r, 0.05 * r, p.kitDeep, p.outline, 1 * inv);
  plate(ctx, 0.75 * r, 0.65 * r, 0.2 * r, 0.26 * r, 0.03 * r, p.kit, p.outline, 0.5 * inv);
}

/**
 * Boss 2. Bus driver: a seat-wide frame, hazard bands on the shoulders, a peaked
 * cap with a visor, and a steering wheel held out where it can be seen.
 */
function drawChauffor(ctx: CanvasRenderingContext2D, e: Enemy, d: Draw, flash: boolean): void {
  const art = ENEMY_ART.chauffor;
  const p = enemyPaintFor('chauffor', flash);
  const r = e.radius;
  const inv = d.inv;
  burstTelegraph(ctx, d, r, e.timer, art.telegraph);

  // Seat back behind the driver.
  plate(ctx, -1.0 * r, -0.66 * r, 0.44 * r, 1.32 * r, 0.12 * r, p.kitDeep, p.outline, 1.3 * inv);

  // Cab body: a wide hard trapezoid.
  ctx.beginPath();
  ctx.moveTo(0.42 * r, -0.58 * r);
  ctx.lineTo(-0.5 * r, -0.66 * r);
  ctx.lineTo(-0.5 * r, 0.66 * r);
  ctx.lineTo(0.42 * r, 0.58 * r);
  ctx.closePath();
  seal(ctx, p.shell, p.outline, 1.6 * inv);

  // Rim on the leading edge, before the parts in front of it.
  ctx.beginPath();
  ctx.moveTo(0.4 * r, -0.56 * r);
  ctx.lineTo(0.4 * r, 0.56 * r);
  ctx.strokeStyle = p.rim;
  ctx.lineWidth = 1.6 * inv;
  ctx.stroke();

  // Shoulder bar and hazard bands.
  plate(ctx, -0.18 * r, -0.64 * r, 0.5 * r, 1.28 * r, 0.1 * r, p.body, p.outline, 1.4 * inv);
  plate(ctx, -0.34 * r, -0.62 * r, 0.36 * r, 0.16 * r, 0.03 * r, p.kit, p.outline, 0.7 * inv);
  plate(ctx, -0.34 * r, 0.46 * r, 0.36 * r, 0.16 * r, 0.03 * r, p.kit, p.outline, 0.7 * inv);
  // Belt.
  plate(ctx, -0.46 * r, 0.36 * r, 0.8 * r, 0.1 * r, 0.02 * r, p.shade, p.outline, 0);

  // Arms: one out to the wheel.
  taper(ctx, 0.12 * r, 0.44 * r, 0.66 * r, 0.56 * r, 0.16 * r, 0.1 * r, p.body, p.outline, 1 * inv);
  taper(ctx, 0.1 * r, -0.44 * r, 0.44 * r, -0.56 * r, 0.15 * r, 0.09 * r, p.body, p.outline, 1 * inv);

  // Cap behind the face, visor, badge.
  discSolid(ctx, 0.42 * r, 0, 0.34 * r, p.hatDeep, p.outline, 1.2 * inv);
  headMass(ctx, 0.6 * r, 0, 0.23 * r, p, p.hatDeep, p.detail, inv);
  ctx.beginPath();
  ctx.moveTo(0.6 * r, -0.18 * r);
  ctx.lineTo(0.96 * r, -0.03 * r);
  ctx.lineTo(0.96 * r, 0.05 * r);
  ctx.lineTo(0.6 * r, 0.16 * r);
  ctx.closePath();
  ctx.fillStyle = p.hatDeep;
  ctx.fill();
  disc(ctx, 0.42 * r, 0, 0.065 * r, p.kit);

  // Steering wheel, out front and clearly a wheel: tyre, bright rim, spokes, hub.
  const wx = 1.12 * r;
  discSolid(ctx, wx, 0, 0.34 * r, p.kitDeep, p.outline, 1.2 * inv);
  disc(ctx, wx, 0, 0.2 * r, p.shell);
  ctx.beginPath();
  ctx.arc(wx, 0, 0.34 * r, -1.0, 1.0);
  ctx.strokeStyle = p.kit;
  ctx.lineWidth = 2.4 * inv;
  ctx.stroke();
  taper(ctx, wx - 0.28 * r, 0, wx + 0.28 * r, 0, 0.035 * r, 0.035 * r, p.kit, p.outline, 0);
  taper(ctx, wx, -0.28 * r, wx, 0.28 * r, 0.035 * r, 0.035 * r, p.kit, p.outline, 0);
  disc(ctx, wx, 0, 0.1 * r, p.kit);
  // Hand on the rim.
  discSolid(ctx, wx - 0.2 * r, 0.26 * r, 0.11 * r, p.head, p.outline, 0.9 * inv);
}

function drawOneEnemy(d: Draw, e: Enemy): void {
  const ctx = d.ctx;
  const flash = e.flash > 0;
  const boss = e.type === 'nattvakt' || e.type === 'chauffor';
  const alpha = e.alpha < 1 ? e.alpha : 1;

  eliteAura(ctx, e, d);
  if (boss) {
    drawGlow(ctx, glowSprite(ENEMY_ART[e.type].look.accent), e.x, e.y, e.radius * 2.6, 0.16);
  }

  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(facingOf(d, e));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = alpha;
  if (!flash && e.stun > 0) {
    ctx.save();
    ctx.rotate(Math.sin(d.t * 18 + e.phase) * 0.14);
  }

  switch (e.type) {
    case 'fyllo':
      drawFyllo(ctx, e, d, flash);
      break;
    case 'duva':
      drawDuva(ctx, e, d, flash);
      break;
    case 'skugga':
      drawSkugga(ctx, e, d, flash);
      break;
    case 'vaktmastare':
      drawVaktmastare(ctx, e, d, flash);
      break;
    case 'sparkcykel':
      drawSparkcykel(ctx, e, d, flash);
      break;
    case 'nattvakt':
      drawNattvakt(ctx, e, d, flash);
      break;
    case 'chauffor':
      drawChauffor(ctx, e, d, flash);
      break;
    default:
      break;
  }

  if (!flash && e.stun > 0) ctx.restore();
  ctx.restore();

  healthBar(ctx, e, d);
}

export function drawEnemies(d: Draw): void {
  const st = d.state;
  for (let i = 0; i < st.enemies.length; i++) {
    const e = st.enemies[i];
    if (e.hp <= 0) continue;
    if (!visible(d, e.x, e.y, 110)) continue;
    drawOneEnemy(d, e);
  }
}

/* --- player ------------------------------------------------------------- */

/**
 * The weapon in the hand. This is what states "armed" at a glance; the projectile
 * systems already draw the effect, this is the silhouette that carries it.
 */
function drawHeldWeapon(
  ctx: CanvasRenderingContext2D,
  d: Draw,
  r: number,
  id: keyof typeof WEAPON_LOOK,
  evolved: boolean,
  skin: string,
): void {
  const look = WEAPON_LOOK[id];
  const core = evolved ? look.evo : look.core;
  const hot = evolved ? look.evoHot : look.hot;
  const hx = r * 0.78;
  const hy = r * 0.58;

  // Hand gripping it.
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(hx, hy, r * 0.14, 0, TAU);
  ctx.fill();

  switch (id) {
    case 'nyckel': {
      ctx.strokeStyle = hot;
      ctx.lineWidth = 2.6 * d.inv;
      ctx.beginPath();
      ctx.arc(hx + r * 0.18, hy + r * 0.06, r * 0.17, 0, TAU);
      ctx.moveTo(hx + r * 0.18, hy + r * 0.23);
      ctx.lineTo(hx + r * 0.18, hy + r * 0.48);
      ctx.moveTo(hx + r * 0.18, hy + r * 0.48);
      ctx.lineTo(hx + r * 0.34, hy + r * 0.48);
      ctx.moveTo(hx + r * 0.18, hy + r * 0.34);
      ctx.lineTo(hx + r * 0.32, hy + r * 0.34);
      ctx.stroke();
      break;
    }
    case 'korv': {
      ctx.save();
      ctx.translate(hx + r * 0.26, hy + r * 0.12);
      ctx.rotate(0.5);
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.roundRect(-r * 0.3, -r * 0.1, r * 0.62, r * 0.2, r * 0.1);
      ctx.fill();
      ctx.fillStyle = hot;
      ctx.fillRect(-r * 0.12, -r * 0.06, r * 0.12, r * 0.12);
      ctx.restore();
      break;
    }
    case 'telefon': {
      ctx.save();
      ctx.translate(hx + r * 0.24, hy + r * 0.06);
      ctx.rotate(-0.35);
      ctx.fillStyle = '#0b1017';
      ctx.beginPath();
      ctx.roundRect(-r * 0.16, -r * 0.28, r * 0.32, r * 0.56, r * 0.07);
      ctx.fill();
      ctx.fillStyle = hot;
      ctx.fillRect(-r * 0.1, -r * 0.2, r * 0.2, r * 0.34);
      ctx.restore();
      break;
    }
    case 'spray': {
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.roundRect(hx + r * 0.1, hy - r * 0.12, r * 0.22, r * 0.4, r * 0.06);
      ctx.fill();
      ctx.fillStyle = hot;
      ctx.fillRect(hx + r * 0.28, hy - r * 0.06, r * 0.1, r * 0.12);
      // Nozzle puff.
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(hx + r * 0.42, hy - r * 0.06);
      ctx.lineTo(hx + r * 0.9, hy - r * 0.3);
      ctx.lineTo(hx + r * 0.9, hy + r * 0.18);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'vagn': {
      ctx.strokeStyle = PAL.steel;
      ctx.lineWidth = 2.4 * d.inv;
      ctx.beginPath();
      ctx.moveTo(hx + r * 0.5, hy - r * 0.24);
      ctx.lineTo(hx + r * 0.86, hy - r * 0.24);
      ctx.lineTo(hx + r * 0.86, hy + r * 0.24);
      ctx.lineTo(hx + r * 0.5, hy + r * 0.24);
      ctx.stroke();
      ctx.fillStyle = hot;
      ctx.fillRect(hx + r * 0.42, hy - r * 0.3, r * 0.1, r * 0.6);
      break;
    }
    case 'ficklampa': {
      ctx.save();
      ctx.translate(hx + r * 0.2, hy);
      ctx.fillStyle = PAL.steel;
      ctx.beginPath();
      ctx.roundRect(-r * 0.1, -r * 0.13, r * 0.34, r * 0.26, r * 0.05);
      ctx.fill();
      // Cone of the lamp, low alpha so it never competes with the beam effect.
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.moveTo(r * 0.24, -r * 0.13);
      ctx.lineTo(r * 1.5, -r * 0.62);
      ctx.lineTo(r * 1.5, r * 0.62);
      ctx.lineTo(r * 0.24, r * 0.13);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = hot;
      ctx.fillRect(r * 0.22, -r * 0.1, r * 0.06, r * 0.2);
      ctx.restore();
      break;
    }
    default:
      break;
  }
}

/**
 * Nattvandraren: long split coat with a cyan sash across it, hood behind the
 * head, lit face at the leading edge. No trim ring.
 */
function drawNattvandraren(
  ctx: CanvasRenderingContext2D,
  d: Draw,
  r: number,
  art: (typeof CHAR_ART)['nattvandraren'],
  p: SpritePaint,
): void {
  const inv = d.inv;

  // Coat tails behind.
  ctx.beginPath();
  ctx.moveTo(-0.06 * r, -0.62 * r);
  ctx.lineTo(-0.78 * r, -0.54 * r);
  ctx.lineTo(-0.94 * r, 0.06 * r);
  ctx.lineTo(-0.66 * r, 0.66 * r);
  ctx.lineTo(0.04 * r, 0.6 * r);
  ctx.closePath();
  seal(ctx, p.shell, p.outline, 1.3 * inv);

  // Rim on the coat's leading edge, before the arms and head.
  ctx.beginPath();
  ctx.moveTo(-0.04 * r, -0.56 * r);
  ctx.lineTo(0.02 * r, 0.54 * r);
  ctx.strokeStyle = p.rim;
  ctx.lineWidth = 1.3 * inv;
  ctx.stroke();

  // Shoulder bar and both arms.
  plate(ctx, -0.14 * r, -0.54 * r, 0.4 * r, 1.08 * r, 0.1 * r, p.body, p.outline, 1.3 * inv);
  taper(ctx, 0.12 * r, -0.44 * r, 0.5 * r, -0.56 * r, 0.12 * r, 0.07 * r, p.body, p.outline, 0.9 * inv);
  taper(ctx, 0.12 * r, 0.44 * r, 0.56 * r, 0.56 * r, 0.12 * r, 0.07 * r, p.body, p.outline, 0.9 * inv);
  discSolid(ctx, 0.56 * r, 0.57 * r, 0.1 * r, p.head, p.outline, 0.8 * inv);
  discSolid(ctx, 0.5 * r, -0.56 * r, 0.1 * r, p.head, p.outline, 0.8 * inv);

  // Hood mass behind the head: a collar, not a ring.
  ctx.beginPath();
  ctx.moveTo(0.3 * r, -0.42 * r);
  ctx.lineTo(-0.26 * r, -0.14 * r);
  ctx.lineTo(-0.26 * r, 0.14 * r);
  ctx.lineTo(0.3 * r, 0.42 * r);
  ctx.closePath();
  seal(ctx, p.hat, p.outline, 1.1 * inv);

  // Sash: the single accent garment element, on the coat in both states.
  ctx.beginPath();
  ctx.moveTo(-0.48 * r, -0.56 * r);
  ctx.lineTo(-0.28 * r, -0.6 * r);
  ctx.lineTo(0.16 * r, 0.36 * r);
  ctx.lineTo(-0.04 * r, 0.42 * r);
  ctx.closePath();
  ctx.fillStyle = art.accent;
  ctx.fill();

  // Neck gap, then the head breaking the shoulder line.
  taper(ctx, 0.24 * r, -0.02 * r, 0.52 * r, -0.04 * r, 0.14 * r, 0.13 * r, p.outline, p.outline, 0);
  headMass(ctx, 0.68 * r, -0.02 * r, 0.27 * r, p, p.hat, null, inv);
}

/**
 * Pensionären: heavy round overcoat, wide flat cap with a forward brim, amber
 * scarf and a walking stick planted out front.
 */
function drawPensionaren(
  ctx: CanvasRenderingContext2D,
  d: Draw,
  r: number,
  art: (typeof CHAR_ART)['pensionaren'],
  p: SpritePaint,
): void {
  const inv = d.inv;

  // Overcoat: hunched egg, hem dragged back. Deliberately narrower than a disc:
  // a round mass with a head inside it reads as a coin/medallion, so the coat
  // stops well short and the head, arms and stick finish the silhouette.
  ctx.beginPath();
  ctx.ellipse(-0.24 * r, 0, 0.6 * r, 0.62 * r, 0, 0, TAU);
  seal(ctx, p.shell, p.outline, 1.5 * inv);
  // Back panel, lighter: the coat is a body, not a flat disc.
  ctx.beginPath();
  ctx.ellipse(-0.3 * r, 0, 0.42 * r, 0.46 * r, 0, 0, TAU);
  ctx.fillStyle = p.body;
  ctx.fill();

  // Shoulder bar and short thick arms reaching past the coat edge.
  plate(ctx, -0.16 * r, -0.5 * r, 0.34 * r, 1.0 * r, 0.1 * r, p.body, p.outline, 1.1 * inv);
  taper(ctx, 0.04 * r, -0.42 * r, 0.58 * r, -0.44 * r, 0.14 * r, 0.09 * r, p.body, p.outline, 0.9 * inv);
  taper(ctx, 0.04 * r, 0.42 * r, 0.66 * r, 0.5 * r, 0.14 * r, 0.09 * r, p.body, p.outline, 0.9 * inv);

  // Scarf: accent band at the collar, tucked behind the head.
  ctx.beginPath();
  ctx.moveTo(0.24 * r, -0.32 * r);
  ctx.quadraticCurveTo(0.46 * r, 0, 0.24 * r, 0.32 * r);
  ctx.lineTo(0.08 * r, 0.28 * r);
  ctx.quadraticCurveTo(0.3 * r, 0, 0.08 * r, -0.28 * r);
  ctx.closePath();
  ctx.fillStyle = art.accent;
  ctx.fill();

  // Neck gap, then the head out past the coat line.
  taper(ctx, 0.26 * r, 0, 0.48 * r, -0.02 * r, 0.13 * r, 0.12 * r, p.outline, p.outline, 0);
  headMass(ctx, 0.68 * r, -0.02 * r, 0.27 * r, p, p.hat, p.detail, inv);

  // Flat cap: the crown is the headMass crown; the peak projects past the head
  // so it never covers the lit face. A big brim drawn over the face turns the
  // head into a pale semicircle under a dark beak.
  ctx.beginPath();
  ctx.moveTo(0.88 * r, -0.18 * r);
  ctx.lineTo(1.26 * r, -0.04 * r);
  ctx.lineTo(1.26 * r, 0.07 * r);
  ctx.lineTo(0.88 * r, 0.12 * r);
  ctx.closePath();
  seal(ctx, p.hatDeep, p.outline, 0.9 * inv);

  // Walking stick planted forward, from the front hand.
  taper(ctx, 0.6 * r, 0.54 * r, 1.32 * r, 0.94 * r, 0.05 * r, 0.045 * r, p.kit, p.outline, 0.5 * inv);
  taper(ctx, 1.32 * r, 0.94 * r, 1.22 * r, 0.76 * r, 0.045 * r, 0.04 * r, p.kit, p.outline, 0.4 * inv);
}

/**
 * Studenten: slim hoodie, backpack with a reflective strap, beanie with the
 * accent fold and over-ear headphones.
 */
function drawStudenten(
  ctx: CanvasRenderingContext2D,
  d: Draw,
  r: number,
  art: (typeof CHAR_ART)['studenten'],
  p: SpritePaint,
): void {
  const inv = d.inv;

  // Backpack behind: a hard rectangle, the slim-body cue.
  plate(ctx, -0.9 * r, -0.4 * r, 0.62 * r, 0.8 * r, 0.1 * r, p.hatDeep, p.outline, 1.3 * inv);
  plate(ctx, -0.82 * r, -0.3 * r, 0.09 * r, 0.6 * r, 0.02 * r, art.accent, p.outline, 0.3 * inv);

  // Slim torso.
  plate(ctx, -0.24 * r, -0.44 * r, 0.56 * r, 0.88 * r, 0.18 * r, p.shell, p.outline, 1.3 * inv);
  // Rim on the leading edge of the torso.
  ctx.beginPath();
  ctx.moveTo(0.3 * r, -0.36 * r);
  ctx.lineTo(0.3 * r, 0.36 * r);
  ctx.strokeStyle = p.rim;
  ctx.lineWidth = 1.3 * inv;
  ctx.stroke();

  // Shoulder bar and arms.
  plate(ctx, -0.12 * r, -0.46 * r, 0.34 * r, 0.92 * r, 0.09 * r, p.body, p.outline, 1.2 * inv);
  taper(ctx, 0.1 * r, -0.38 * r, 0.44 * r, -0.5 * r, 0.1 * r, 0.06 * r, p.body, p.outline, 0.8 * inv);
  taper(ctx, 0.1 * r, 0.38 * r, 0.48 * r, 0.5 * r, 0.1 * r, 0.06 * r, p.body, p.outline, 0.8 * inv);

  // Neck gap, then the head.
  taper(ctx, 0.16 * r, 0, 0.4 * r, -0.02 * r, 0.13 * r, 0.11 * r, p.outline, p.outline, 0);
  headMass(ctx, 0.56 * r, -0.02 * r, 0.25 * r, p, p.hat, p.detail, inv);

  // Beanie over the crown, accent fold at the front of it.
  ctx.beginPath();
  ctx.arc(0.44 * r, -0.06 * r, 0.3 * r, Math.PI * 0.88, Math.PI * 1.96);
  ctx.closePath();
  seal(ctx, p.hat, p.outline, 1.1 * inv);
  ctx.strokeStyle = art.accent;
  ctx.lineWidth = 0.08 * r;
  ctx.beginPath();
  ctx.arc(0.46 * r, -0.06 * r, 0.25 * r, Math.PI * 0.96, Math.PI * 1.8);
  ctx.stroke();
  // Headphone cups at the ears.
  discSolid(ctx, 0.4 * r, -0.32 * r, 0.09 * r, p.kit, p.outline, 0.6 * inv);
  discSolid(ctx, 0.4 * r, 0.32 * r, 0.09 * r, p.kit, p.outline, 0.6 * inv);
}

export function drawPlayer(d: Draw): void {
  const st = d.state;
  const p = st.player;
  const ctx = d.ctx;
  const character = st.config.character;
  const art = CHAR_ART[character];
  const state = CHAR_PAINT[character];
  const r = 15;
  const flash = p.flash > 0;
  const paint = flash ? state.flash : state.normal;
  const invuln = p.invuln > 0;
  const moving = p.vx * p.vx + p.vy * p.vy > 100;
  const bob = moving ? Math.sin(d.t * 15) * 1.2 : Math.sin(d.t * 2.4) * 0.6;

  // Weapon accent: the active starting weapon's colour is the player's light.
  const primary = st.weapons.length > 0 ? st.weapons[0] : null;
  const accent = primary ? WEAPON_LOOK[primary.id].core : art.accent;

  drawGlow(ctx, glowSprite(art.accent), p.x, p.y, 46, 0.16);

  ctx.save();
  ctx.translate(p.x, p.y + bob);
  ctx.rotate(p.facing);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (invuln) {
    ctx.strokeStyle = PAL.fluoro;
    ctx.globalAlpha = 0.35 + 0.25 * Math.sin(d.t * 14);
    ctx.lineWidth = 2 * d.inv;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.5, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  switch (character) {
    case 'pensionaren':
      drawPensionaren(ctx, d, r, art, paint);
      break;
    case 'studenten':
      drawStudenten(ctx, d, r, art, paint);
      break;
    default:
      drawNattvandraren(ctx, d, r, art, paint);
      break;
  }

  if (primary) {
    drawHeldWeapon(ctx, d, r, primary.id, primary.evolved, paint.head);
  }

  ctx.restore();

  drawGlow(ctx, glowSprite(accent), p.x + Math.cos(p.facing) * 10, p.y + Math.sin(p.facing) * 10 + bob, 24, 0.26);
}

/* --- sprite gallery ------------------------------------------------------ */

const GALLERY_ENEMIES: EnemyType[] = [
  'fyllo',
  'duva',
  'skugga',
  'vaktmastare',
  'sparkcykel',
  'nattvakt',
  'chauffor',
];
const GALLERY_CHARS: CharacterId[] = ['nattvandraren', 'pensionaren', 'studenten'];

function galleryEnemy(type: EnemyType, flash: boolean): Enemy {
  return {
    uid: 0,
    type,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    hp: 100,
    maxHp: 100,
    speed: 0,
    radius: ENEMIES[type].radius,
    damage: 0,
    attackCd: 0,
    flash: flash ? 0.1 : 0,
    stun: 0,
    phase: 0,
    state: 0,
    timer: 0,
    elite: false,
    alpha: 1,
  };
}

/**
 * Debug gallery used by `tools/gallery.mjs`: every enemy and every playable
 * character at in-game scale and at 2x, plus the flashing variants, on the real
 * asphalt value. The draw path it exercises is the one the game uses.
 */
export function drawSpriteGallery(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const state = {
    player: { x: 0, y: 0, facing: 0, vx: 0, vy: 0, flash: 0, invuln: 0 },
    enemies: [] as Enemy[],
    weapons: [],
    config: { character: 'nattvandraren' },
  };
  // Only ctx/state/t/inv are touched by the sprite path.
  const d = { ctx, state, t: 0.9, inv: 1, camX: 0, camY: 0, halfW: 1e6, halfH: 1e6 } as unknown as Draw;

  ctx.fillStyle = PAL.asphalt;
  ctx.fillRect(0, 0, width, height);
  // Slab seams, at the value the game's ground texture actually sits at.
  ctx.strokeStyle = PAL.slabLine;
  ctx.lineWidth = 2;
  for (let x = 0; x < width; x += 120) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 120) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.font = '600 13px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const cell = 168;
  const margin = 88;
  const colX = (i: number): number => margin + i * cell;

  const drawChar = (id: CharacterId, x: number, y: number, scale: number, flash: boolean): void => {
    state.config.character = id;
    state.player.flash = flash ? 0.1 : 0;
    state.player.invuln = 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    drawPlayer(d);
    ctx.restore();
  };

  const drawEnemy = (type: EnemyType, x: number, y: number, scale: number, flash: boolean): void => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    drawOneEnemy(d, galleryEnemy(type, flash));
    ctx.restore();
  };

  // Row 1: in-game scale.
  const rowA = 116;
  ctx.fillStyle = PAL.inkDim;
  ctx.fillText('IN-GAME SCALE · live radius · same draw path as the game', width / 2, 34);
  for (let i = 0; i < GALLERY_ENEMIES.length; i++) {
    drawEnemy(GALLERY_ENEMIES[i], colX(i), rowA, 1, false);
    ctx.fillStyle = PAL.ink;
    ctx.fillText(GALLERY_ENEMIES[i], colX(i), rowA + 66);
  }
  for (let i = 0; i < GALLERY_CHARS.length; i++) {
    drawChar(GALLERY_CHARS[i], colX(7 + i), rowA, 1, false);
    ctx.fillStyle = PAL.ink;
    ctx.fillText(GALLERY_CHARS[i], colX(7 + i), rowA + 66);
  }

  // Row 2: 2x inspection.
  const rowB = 384;
  ctx.fillStyle = PAL.inkDim;
  ctx.fillText('2x INSPECTION', width / 2, 248);
  for (let i = 0; i < GALLERY_ENEMIES.length; i++) {
    drawEnemy(GALLERY_ENEMIES[i], colX(i), rowB, 2, false);
    ctx.fillStyle = PAL.inkDim;
    ctx.fillText(GALLERY_ENEMIES[i], colX(i), rowB + 100);
  }
  for (let i = 0; i < GALLERY_CHARS.length; i++) {
    drawChar(GALLERY_CHARS[i], colX(7 + i), rowB, 2, false);
    ctx.fillStyle = PAL.inkDim;
    ctx.fillText(GALLERY_CHARS[i], colX(7 + i), rowB + 100);
  }

  // Row 3: hit flash, at 2x, player and fyllo.
  const rowC = 640;
  ctx.fillStyle = PAL.inkDim;
  ctx.fillText('HIT FLASH · must stay identifiable', width / 2, 546);
  drawChar('nattvandraren', colX(2), rowC, 2, true);
  drawEnemy('fyllo', colX(5), rowC, 2, true);
  ctx.fillStyle = PAL.ink;
  ctx.fillText('nattvandraren · flash', colX(2), rowC + 100);
  ctx.fillText('fyllo · flash', colX(5), rowC + 100);
}