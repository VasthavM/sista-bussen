/**
 * The dead: five zombie types and two bosses, in the same flat-silhouette
 * style as the player (dark outline, leading-edge rim, two tones plus a prop).
 *
 * What makes them zombies, and what keeps them apart at gameplay zoom:
 *  - Skin is desaturated green-grey (see `palette.ts`), arms reach forward, the
 *    hems are torn (jagged), and every head has dark sockets with a sick glow.
 *  - Shamble: each body lurches on its own phase. Slow and heavy for the
 *    Shambler, a twitchy skitter for the Crawler, a sprint-lean for the Runner.
 *  - Types are told apart by silhouette first and one colour block second:
 *    Shambler = wide brown hunch, Crawler = tiny pale scuttler, Runner = lean
 *    blue streak with rags, Spitter = purple with a swollen green throat,
 *    Charger = dark teal brute with steel horns and shoulder spikes. Bosses are
 *    two to three times the size: the Warden in red riot gear, the Conductor in
 *    amber with a ticket machine and a giant punch.
 *  - Anything that will hurt you telegraphs in red before it lands, exactly as
 *    before: the Spitter's cone fan, the Charger's lane, the bosses' burst ring.
 *  - A hit flash lightens the zombie's own colours; the outline, the sockets
 *    and the eye glow stay, so a flashing zombie stays identifiable.
 */
import type { Enemy, EnemyType } from '../sim/types';
import type { Draw } from './draw';
import { visible } from './draw';
import { ENEMY_ART, ENEMY_PAINT, PAL } from './palette';
import type { SpritePaint } from './palette';
import { DASH, NO_DASH, TAU, disc, discSolid, plate, seal, taper } from './shapes';
import { drawGlow, glowSprite } from './sprites';

function paintFor(type: EnemyType, flash: boolean): SpritePaint {
  const states = ENEMY_PAINT[type];
  return flash ? states.flash : states.normal;
}

function facingOf(d: Draw, e: Enemy): number {
  const st = d.state;
  // Chargers and spitters aim where the sim will aim: at the player. Reading
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

/* --- shared zombie parts -------------------------------------------------- */

/**
 * Shamble: a lurching sway across the facing axis plus a roll, on the enemy's
 * own phase so a crowd never steps in unison. Returns the swing (-1..1) so the
 * limbs can follow the same beat.
 */
function shamble(
  ctx: CanvasRenderingContext2D,
  d: Draw,
  e: Enemy,
  r: number,
  freq: number,
  sway: number,
  roll: number,
): number {
  const s = Math.sin(d.t * freq + e.phase * 3.1);
  ctx.translate(Math.cos(d.t * freq * 0.5 + e.phase) * 0.03 * r, s * sway * r);
  ctx.rotate(s * roll);
  return s;
}

/** Jagged edge from (x0,y0) to (x1,y1), appended to the current path. */
function tear(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  teeth: number,
  depth: number,
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  for (let i = 1; i <= teeth * 2; i++) {
    const t = i / (teeth * 2);
    const out = i % 2 === 1 ? depth : 0;
    ctx.lineTo(x0 + dx * t + nx * out, y0 + dy * t + ny * out);
  }
}

/** Zombie head from above: skin, hollow sockets with a glow, a dark open jaw. */
function zombieHead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rad: number,
  p: SpritePaint,
  glow: string,
  inv: number,
  jaw: number,
): void {
  discSolid(ctx, x, y, rad, p.head, p.outline, 1.1 * inv);
  // Thin, patchy hair or scalp over the rear half.
  ctx.beginPath();
  ctx.arc(x - rad * 0.12, y, rad * 0.98, Math.PI * 0.62, Math.PI * 1.38);
  ctx.closePath();
  ctx.fillStyle = p.headDeep;
  ctx.fill();
  // Torn scalp: a bite out of the crown.
  disc(ctx, x - rad * 0.55, y - rad * 0.5, rad * 0.26, p.outline);
  // Open jaw: a dark wedge on the leading edge.
  ctx.beginPath();
  ctx.moveTo(x + rad * 0.98, y);
  ctx.lineTo(x + rad * 0.3, y - rad * (0.22 + 0.2 * jaw));
  ctx.lineTo(x + rad * 0.3, y + rad * (0.22 + 0.2 * jaw));
  ctx.closePath();
  ctx.fillStyle = p.outline;
  ctx.fill();
  // Sockets, then the glow in them: the thing that survives the flash.
  disc(ctx, x + rad * 0.34, y - rad * 0.4, rad * 0.22, p.outline);
  disc(ctx, x + rad * 0.34, y + rad * 0.4, rad * 0.22, p.outline);
  disc(ctx, x + rad * 0.4, y - rad * 0.4, rad * 0.12, glow);
  disc(ctx, x + rad * 0.4, y + rad * 0.4, rad * 0.12, glow);
  // Rim inside the head, front arc only.
  ctx.beginPath();
  ctx.arc(x, y, rad * 0.86, -0.7, -0.3);
  ctx.strokeStyle = p.rim;
  ctx.lineWidth = 1.2 * inv;
  ctx.stroke();
}

/** A reaching arm: tapered wedge from the shoulder, a fist and three claws. */
function reach(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  w0: number,
  w1: number,
  p: SpritePaint,
  sleeve: string,
  inv: number,
  claws: number,
): void {
  taper(ctx, x0, y0, x1, y1, w0, w1, sleeve, p.outline, 1 * inv);
  // Bare forearm: the skin read on the last third.
  taper(ctx, x0 + (x1 - x0) * 0.55, y0 + (y1 - y0) * 0.55, x1, y1, w0 * 0.72, w1, p.head, p.outline, 0.8 * inv);
  discSolid(ctx, x1, y1, w1 * 1.2, p.head, p.outline, 0.8 * inv);
  const dir = Math.atan2(y1 - y0, x1 - x0);
  ctx.strokeStyle = p.outline;
  ctx.lineWidth = 1.2 * inv;
  for (let i = 0; i < claws; i++) {
    const a = dir + (i - (claws - 1) / 2) * 0.55;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 + Math.cos(a) * w1 * 3, y1 + Math.sin(a) * w1 * 3);
    ctx.stroke();
  }
}

/* --- Shambler (fyllo): slow, wide, tanky -------------------------------- */

function drawShambler(ctx: CanvasRenderingContext2D, e: Enemy, d: Draw, flash: boolean): void {
  const art = ENEMY_ART.fyllo;
  const p = paintFor('fyllo', flash);
  const r = e.radius;
  const inv = d.inv;
  const s = shamble(ctx, d, e, r, 3.2, 0.07, 0.13);
  const arm = 0.1 * r * s;

  // Torn coat, dragged back and down: the hunch, with a ragged tail.
  ctx.beginPath();
  ctx.moveTo(0.3 * r, -0.56 * r);
  ctx.lineTo(-0.5 * r, -0.76 * r);
  tear(ctx, -0.5 * r, -0.76 * r, -1.0 * r, -0.2 * r, 3, 0.1 * r);
  tear(ctx, -1.0 * r, -0.2 * r, -0.9 * r, 0.5 * r, 3, 0.1 * r);
  ctx.lineTo(-0.5 * r, 0.78 * r);
  ctx.lineTo(0.2 * r, 0.62 * r);
  ctx.lineTo(0.36 * r, 0.1 * r);
  ctx.closePath();
  seal(ctx, p.shell, p.outline, 1.4 * inv);

  // Shoulder bar and a torn shirt panel: the dirty-white patch is the read.
  plate(ctx, -0.18 * r, -0.68 * r, 0.5 * r, 1.36 * r, 0.1 * r, p.body, p.outline, 1.2 * inv);
  plate(ctx, -0.34 * r, -0.28 * r, 0.34 * r, 0.5 * r, 0.04 * r, p.kit, p.outline, 0.6 * inv);
  // Exposed ribs through the tear.
  ctx.strokeStyle = p.outline;
  ctx.lineWidth = 1 * inv;
  for (let i = 0; i < 2; i++) {
    ctx.beginPath();
    ctx.moveTo(-0.3 * r, (-0.16 + i * 0.22) * r);
    ctx.lineTo(-0.04 * r, (-0.16 + i * 0.22) * r);
    ctx.stroke();
  }

  // Both arms out in front, swinging against each other.
  reach(ctx, 0.14 * r, -0.56 * r, 1.0 * r + arm, -0.36 * r, 0.16 * r, 0.09 * r, p, p.body, inv, 3);
  reach(ctx, 0.14 * r, 0.56 * r, 1.0 * r - arm, 0.4 * r, 0.16 * r, 0.09 * r, p, p.body, inv, 3);

  // Head hung low and forward, jaw slack.
  zombieHead(ctx, 0.74 * r, 0.02 * r, 0.3 * r, p, art.look.accent, inv, 0.8 + 0.2 * s);
}

/* --- Crawler (duva): tiny, fast, in flocks ------------------------------ */

function drawCrawler(ctx: CanvasRenderingContext2D, e: Enemy, d: Draw, flash: boolean): void {
  const art = ENEMY_ART.duva;
  const p = paintFor('duva', flash);
  const r = e.radius;
  const inv = d.inv;
  // Skitter: a fast, small, twitchy beat.
  const s = shamble(ctx, d, e, r, 13, 0.05, 0.08);
  const pull = Math.sin(d.t * 13 + e.phase * 3.1);

  // Legless torso dragged behind: a torn, tapering trail.
  ctx.beginPath();
  ctx.moveTo(0.3 * r, -0.34 * r);
  ctx.lineTo(-0.4 * r, -0.4 * r);
  tear(ctx, -0.4 * r, -0.4 * r, -1.1 * r, -0.1 * r, 2, 0.1 * r);
  tear(ctx, -1.1 * r, -0.1 * r, -0.4 * r, 0.4 * r, 2, 0.1 * r);
  ctx.lineTo(0.3 * r, 0.34 * r);
  ctx.closePath();
  seal(ctx, p.body, p.outline, 1 * inv);
  // Spine ridge and torn shirt strip: the pale-on-dark read.
  plate(ctx, -0.5 * r, -0.08 * r, 0.7 * r, 0.16 * r, 0.04 * r, p.kit, p.outline, 0);

  // Two long arms hauling it forward, alternating.
  reach(ctx, 0.1 * r, -0.4 * r, 1.0 * r + pull * 0.2 * r, -0.62 * r, 0.14 * r, 0.09 * r, p, p.shell, inv, 3);
  reach(ctx, 0.1 * r, 0.4 * r, 1.0 * r - pull * 0.2 * r, 0.62 * r, 0.14 * r, 0.09 * r, p, p.shell, inv, 3);

  zombieHead(ctx, 0.46 * r, 0, 0.34 * r, p, art.look.accent, inv, 1);
}

/* --- Runner (skugga): fast, erratic, fades ------------------------------ */

function drawRunner(ctx: CanvasRenderingContext2D, e: Enemy, d: Draw, flash: boolean): void {
  const art = ENEMY_ART.skugga;
  const p = paintFor('skugga', flash);
  const r = e.radius;
  const inv = d.inv;
  const s = shamble(ctx, d, e, r, 9, 0.1, 0.16);

  // Streaming rags behind: three torn strips, the motion read.
  ctx.save();
  ctx.strokeStyle = p.body;
  ctx.lineWidth = 2.2 * inv;
  for (let i = 0; i < 3; i++) {
    const off = (i - 1) * 0.3 * r;
    ctx.globalAlpha = 0.5 - i * 0.1;
    ctx.beginPath();
    ctx.moveTo(-0.4 * r, off * 0.5);
    ctx.quadraticCurveTo(-1.0 * r, off + s * 0.2 * r, -1.7 * r - i * 0.2 * r, off * 0.4);
    ctx.stroke();
  }
  ctx.restore();

  // Torn hoodie, leaning hard into the sprint: narrow and long.
  ctx.beginPath();
  ctx.moveTo(0.52 * r, -0.34 * r);
  ctx.lineTo(-0.4 * r, -0.5 * r);
  tear(ctx, -0.4 * r, -0.5 * r, -0.64 * r, 0.1 * r, 2, 0.12 * r);
  ctx.lineTo(-0.3 * r, 0.5 * r);
  ctx.lineTo(0.5 * r, 0.32 * r);
  ctx.closePath();
  seal(ctx, p.body, p.outline, 1.2 * inv);
  // Hood over the back of the neck, in the darker tone.
  ctx.beginPath();
  ctx.arc(0.3 * r, 0, 0.34 * r, Math.PI * 0.5, Math.PI * 1.5);
  ctx.closePath();
  ctx.fillStyle = p.shell;
  ctx.fill();

  // Sprint arms: one thrown forward, one back, then swapping on the beat.
  reach(ctx, 0.2 * r, -0.4 * r, 1.0 * r + s * 0.18 * r, -0.2 * r, 0.12 * r, 0.075 * r, p, p.body, inv, 3);
  reach(ctx, 0.2 * r, 0.4 * r, 0.7 * r - s * 0.18 * r, 0.62 * r, 0.12 * r, 0.075 * r, p, p.body, inv, 3);

  // Head thrust forward, mouth wide, eyes cold.
  zombieHead(ctx, 0.72 * r, 0, 0.26 * r, p, art.look.accent, inv, 1);
}

/* --- Spitter (vaktmastare): keeps its distance, spits cones ------------- */

function drawSpitter(ctx: CanvasRenderingContext2D, e: Enemy, d: Draw, flash: boolean): void {
  const art = ENEMY_ART.vaktmastare;
  const p = paintFor('vaktmastare', flash);
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

  const s = shamble(ctx, d, e, r, 2.6, 0.05, 0.07);
  const swell = winding ? 1 + 0.45 * (1 - e.timer / 0.55) : 1 + 0.08 * Math.sin(d.t * 5 + e.phase);

  // Bloated, torn coat: square at the shoulders, swollen at the belly.
  ctx.beginPath();
  ctx.moveTo(0.3 * r, -0.58 * r);
  ctx.lineTo(-0.5 * r, -0.74 * r);
  ctx.lineTo(-0.7 * r, -0.2 * r);
  tear(ctx, -0.7 * r, -0.2 * r, -0.66 * r, 0.5 * r, 3, 0.14 * r);
  ctx.lineTo(-0.3 * r, 0.76 * r);
  ctx.lineTo(0.26 * r, 0.62 * r);
  ctx.closePath();
  seal(ctx, p.shell, p.outline, 1.4 * inv);
  plate(ctx, -0.2 * r, -0.76 * r, 0.5 * r, 1.52 * r, 0.12 * r, p.body, p.outline, 1.1 * inv);
  // Bile stains on the back: the toxic accent, two bars.
  plate(ctx, -0.46 * r, -0.34 * r, 0.4 * r, 0.1 * r, 0.03 * r, p.kitDeep, p.outline, 0.5 * inv);
  plate(ctx, -0.46 * r, 0.22 * r, 0.4 * r, 0.1 * r, 0.03 * r, p.kitDeep, p.outline, 0.5 * inv);

  // Arms hang forward, limp, claws loosely open.
  reach(ctx, 0.12 * r, -0.5 * r, 0.7 * r, -0.62 * r, 0.14 * r, 0.085 * r, p, p.body, inv, 2);
  reach(ctx, 0.12 * r, 0.5 * r, 0.7 * r, 0.62 * r + s * 0.06 * r, 0.14 * r, 0.085 * r, p, p.body, inv, 2);

  // Throat sac: the swelling green bulb is what says "spits".
  ctx.beginPath();
  ctx.ellipse(0.86 * r, 0, 0.34 * r * swell, 0.3 * r * swell, 0, 0, TAU);
  seal(ctx, p.kit, p.outline, 1 * inv);
  disc(ctx, 0.9 * r, -0.08 * r, 0.09 * r * swell, p.kitDeep);
  disc(ctx, 0.82 * r, 0.1 * r, 0.06 * r * swell, p.kitDeep);

  // Head tipped back behind the sac, jaw unhinged.
  zombieHead(ctx, 0.5 * r, 0, 0.27 * r, p, art.look.accent, inv, winding ? 1 : 0.6);
}

/* --- Charger (sparkcykel): telegraphed straight charge ------------------ */

function drawCharger(ctx: CanvasRenderingContext2D, e: Enemy, d: Draw, flash: boolean): void {
  const art = ENEMY_ART.sparkcykel;
  const p = paintFor('sparkcykel', flash);
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

  // Heavy lurch while idle, a driven lean once it commits.
  const charging = e.state === 2;
  const s = shamble(ctx, d, e, r, charging ? 16 : 3.6, charging ? 0.02 : 0.05, charging ? 0.03 : 0.08);
  const lean = e.state === 1 ? 0.12 * r : 0;

  // Wide hunched body in scrap plate: the brute.
  ctx.beginPath();
  ctx.moveTo(0.42 * r + lean, -0.66 * r);
  ctx.lineTo(-0.56 * r, -0.8 * r);
  tear(ctx, -0.56 * r, -0.8 * r, -0.86 * r, 0, 2, 0.14 * r);
  tear(ctx, -0.86 * r, 0, -0.56 * r, 0.8 * r, 2, 0.14 * r);
  ctx.lineTo(0.42 * r + lean, 0.66 * r);
  ctx.closePath();
  seal(ctx, p.shell, p.outline, 1.5 * inv);
  // Rim on the leading edge before anything is drawn over it.
  ctx.beginPath();
  ctx.moveTo(0.42 * r + lean, -0.62 * r);
  ctx.lineTo(0.42 * r + lean, 0.62 * r);
  ctx.strokeStyle = p.rim;
  ctx.lineWidth = 1.5 * inv;
  ctx.stroke();

  // Steel shoulder plates with forward spikes: the silhouette signature.
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-0.3 * r, side * 0.56 * r);
    ctx.lineTo(0.3 * r, side * 0.62 * r);
    ctx.lineTo(0.7 * r + lean, side * 0.98 * r);
    ctx.lineTo(0.06 * r, side * 1.02 * r);
    ctx.lineTo(-0.34 * r, side * 0.9 * r);
    ctx.closePath();
    seal(ctx, p.kit, p.outline, 1.1 * inv);
  }
  plate(ctx, -0.4 * r, -0.36 * r, 0.7 * r, 0.72 * r, 0.1 * r, p.body, p.outline, 1.1 * inv);

  // Fists forward, big and low.
  reach(ctx, 0.2 * r, -0.62 * r, 0.96 * r + lean, -0.4 * r + s * 0.04 * r, 0.2 * r, 0.14 * r, p, p.body, inv, 3);
  reach(ctx, 0.2 * r, 0.62 * r, 0.96 * r + lean, 0.4 * r - s * 0.04 * r, 0.2 * r, 0.14 * r, p, p.body, inv, 3);

  // Cracked steel helmet with two horns.
  discSolid(ctx, 0.58 * r + lean, 0, 0.3 * r, p.kit, p.outline, 1.2 * inv);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0.5 * r + lean, side * 0.24 * r);
    ctx.lineTo(0.96 * r + lean, side * 0.42 * r);
    ctx.lineTo(0.62 * r + lean, side * 0.08 * r);
    ctx.closePath();
    seal(ctx, p.kit, p.outline, 0.8 * inv);
  }
  // Visor slit with the glow, and the face under the brim.
  plate(ctx, 0.64 * r + lean, -0.22 * r, 0.22 * r, 0.44 * r, 0.03 * r, p.outline, p.outline, 0);
  disc(ctx, 0.76 * r + lean, -0.1 * r, 0.06 * r, art.look.accent);
  disc(ctx, 0.76 * r + lean, 0.1 * r, 0.06 * r, art.look.accent);
  // Crack across the helmet.
  ctx.strokeStyle = p.outline;
  ctx.lineWidth = 1 * inv;
  ctx.beginPath();
  ctx.moveTo(0.42 * r + lean, -0.2 * r);
  ctx.lineTo(0.56 * r + lean, -0.02 * r);
  ctx.lineTo(0.5 * r + lean, 0.16 * r);
  ctx.stroke();
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

/* --- The Warden (nattvakt): boss 1, riot gear --------------------------- */

function drawWarden(ctx: CanvasRenderingContext2D, e: Enemy, d: Draw, flash: boolean): void {
  const art = ENEMY_ART.nattvakt;
  const p = paintFor('nattvakt', flash);
  const r = e.radius;
  const inv = d.inv;
  burstTelegraph(ctx, d, r, e.timer, art.telegraph);
  const s = shamble(ctx, d, e, r, 2.2, 0.025, 0.04);

  // Long riot coat, torn at the hem.
  ctx.beginPath();
  ctx.moveTo(0.44 * r, -0.6 * r);
  ctx.lineTo(-0.78 * r, -0.72 * r);
  tear(ctx, -0.78 * r, -0.72 * r, -0.98 * r, 0.2 * r, 4, 0.1 * r);
  tear(ctx, -0.98 * r, 0.2 * r, -0.74 * r, 0.84 * r, 3, 0.1 * r);
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

  // Shoulder bar, riot pauldrons that break the line outward, belt and keyring.
  plate(ctx, -0.16 * r, -0.7 * r, 0.5 * r, 1.4 * r, 0.1 * r, p.body, p.outline, 1.4 * inv);
  plate(ctx, -0.26 * r, -1.04 * r, 0.62 * r, 0.28 * r, 0.06 * r, p.shade, p.outline, 1.1 * inv);
  plate(ctx, -0.26 * r, 0.76 * r, 0.62 * r, 0.28 * r, 0.06 * r, p.shade, p.outline, 1.1 * inv);
  plate(ctx, -0.6 * r, 0.12 * r, 0.94 * r, 0.12 * r, 0.03 * r, p.shade, p.outline, 0);
  for (let i = 0; i < 3; i++) discSolid(ctx, (-0.4 + i * 0.16) * r, 0.34 * r, 0.07 * r, p.kit, p.outline, 0.6 * inv);

  // Right arm out front with a long baton; left arm raised behind a cracked shield.
  reach(ctx, 0.12 * r, 0.5 * r, 0.8 * r, 0.7 * r + s * 0.05 * r, 0.16 * r, 0.1 * r, p, p.body, inv, 3);
  taper(ctx, 0.7 * r, 0.7 * r, 1.5 * r, 0.5 * r, 0.06 * r, 0.05 * r, p.kitDeep, p.outline, 0.8 * inv);
  taper(ctx, 0.08 * r, -0.5 * r, 0.5 * r, -0.74 * r, 0.15 * r, 0.09 * r, p.body, p.outline, 1 * inv);
  ctx.beginPath();
  ctx.moveTo(0.3 * r, -1.14 * r);
  ctx.lineTo(0.98 * r, -1.02 * r);
  ctx.lineTo(1.02 * r, -0.3 * r);
  ctx.lineTo(0.56 * r, -0.2 * r);
  ctx.lineTo(0.28 * r, -0.6 * r);
  ctx.closePath();
  seal(ctx, flash ? '#c9d3dd' : '#6b7683', p.outline, 1.2 * inv);
  ctx.strokeStyle = p.outline;
  ctx.lineWidth = 1.1 * inv;
  ctx.beginPath();
  ctx.moveTo(0.5 * r, -1.1 * r);
  ctx.lineTo(0.72 * r, -0.8 * r);
  ctx.lineTo(0.58 * r, -0.5 * r);
  ctx.stroke();

  // Riot helmet over a rotting face: visor slit glows.
  discSolid(ctx, 0.4 * r, 0, 0.36 * r, p.hatDeep, p.outline, 1.2 * inv);
  discSolid(ctx, 0.62 * r, 0, 0.26 * r, p.head, p.outline, 1.1 * inv);
  ctx.beginPath();
  ctx.arc(0.58 * r, 0, 0.27 * r, Math.PI * 0.55, Math.PI * 1.45);
  ctx.closePath();
  ctx.fillStyle = p.hatDeep;
  ctx.fill();
  plate(ctx, 0.66 * r, -0.2 * r, 0.2 * r, 0.4 * r, 0.04 * r, p.outline, p.outline, 0);
  disc(ctx, 0.78 * r, -0.09 * r, 0.05 * r, art.look.accent);
  disc(ctx, 0.78 * r, 0.09 * r, 0.05 * r, art.look.accent);
}

/* --- The Conductor (chauffor): boss 2, the last wall -------------------- */

function drawConductor(ctx: CanvasRenderingContext2D, e: Enemy, d: Draw, flash: boolean): void {
  const art = ENEMY_ART.chauffor;
  const p = paintFor('chauffor', flash);
  const r = e.radius;
  const inv = d.inv;
  burstTelegraph(ctx, d, r, e.timer, art.telegraph);
  const s = shamble(ctx, d, e, r, 1.9, 0.02, 0.035);

  // Satchel and strap behind: the cash bag he never put down.
  plate(ctx, -1.0 * r, -0.66 * r, 0.44 * r, 1.32 * r, 0.12 * r, p.kitDeep, p.outline, 1.3 * inv);

  // Wide uniform trapezoid, torn at the back.
  ctx.beginPath();
  ctx.moveTo(0.42 * r, -0.58 * r);
  ctx.lineTo(-0.5 * r, -0.66 * r);
  tear(ctx, -0.5 * r, -0.66 * r, -0.5 * r, 0.66 * r, 4, 0.08 * r);
  ctx.lineTo(0.42 * r, 0.58 * r);
  ctx.closePath();
  seal(ctx, p.shell, p.outline, 1.6 * inv);
  ctx.beginPath();
  ctx.moveTo(0.4 * r, -0.56 * r);
  ctx.lineTo(0.4 * r, 0.56 * r);
  ctx.strokeStyle = p.rim;
  ctx.lineWidth = 1.6 * inv;
  ctx.stroke();

  // Shoulder bar and amber hazard bands, belt, and the ticket machine on his chest.
  plate(ctx, -0.18 * r, -0.64 * r, 0.5 * r, 1.28 * r, 0.1 * r, p.body, p.outline, 1.4 * inv);
  plate(ctx, -0.34 * r, -0.62 * r, 0.36 * r, 0.16 * r, 0.03 * r, p.kit, p.outline, 0.7 * inv);
  plate(ctx, -0.34 * r, 0.46 * r, 0.36 * r, 0.16 * r, 0.03 * r, p.kit, p.outline, 0.7 * inv);
  plate(ctx, -0.46 * r, 0.36 * r, 0.8 * r, 0.1 * r, 0.02 * r, p.shade, p.outline, 0);
  plate(ctx, 0.0 * r, -0.28 * r, 0.34 * r, 0.56 * r, 0.05 * r, p.kitDeep, p.outline, 1 * inv);
  plate(ctx, 0.06 * r, -0.2 * r, 0.14 * r, 0.22 * r, 0.02 * r, art.look.accent, p.outline, 0.5 * inv);
  disc(ctx, 0.2 * r, 0.14 * r, 0.06 * r, p.kit);

  // Left arm reaching, right arm swinging a giant ticket punch.
  reach(ctx, 0.1 * r, -0.44 * r, 0.9 * r, -0.62 * r + s * 0.04 * r, 0.16 * r, 0.1 * r, p, p.body, inv, 3);
  taper(ctx, 0.1 * r, 0.44 * r, 0.8 * r, 0.58 * r, 0.16 * r, 0.1 * r, p.body, p.outline, 1 * inv);
  taper(ctx, 0.74 * r, 0.58 * r, 1.4 * r, 0.5 * r, 0.07 * r, 0.06 * r, p.kitDeep, p.outline, 0.8 * inv);
  for (const side of [-1, 1]) {
    taper(ctx, 1.34 * r, 0.5 * r, 1.66 * r, (0.5 + side * 0.2) * r, 0.07 * r, 0.04 * r, PAL.steel, p.outline, 0.7 * inv);
  }
  discSolid(ctx, 0.84 * r, 0.6 * r, 0.11 * r, p.head, p.outline, 0.9 * inv);

  // Peaked cap tipped over a grey face: badge on the crown, visor out front.
  discSolid(ctx, 0.42 * r, 0, 0.34 * r, p.hatDeep, p.outline, 1.2 * inv);
  ctx.beginPath();
  ctx.moveTo(0.7 * r, -0.2 * r);
  ctx.lineTo(1.06 * r, -0.05 * r);
  ctx.lineTo(1.06 * r, 0.05 * r);
  ctx.lineTo(0.7 * r, 0.2 * r);
  ctx.closePath();
  seal(ctx, p.hatDeep, p.outline, 0.9 * inv);
  zombieHead(ctx, 0.62 * r, 0, 0.23 * r, p, art.look.accent, inv, 0.9);
  // Cap crown over the back of the skull, badge on top.
  ctx.beginPath();
  ctx.arc(0.5 * r, 0, 0.3 * r, Math.PI * 0.55, Math.PI * 1.45);
  ctx.closePath();
  ctx.fillStyle = p.hatDeep;
  ctx.fill();
  disc(ctx, 0.42 * r, 0, 0.065 * r, p.kit);
}

/* --- dispatch ------------------------------------------------------------ */

export function drawOneEnemy(d: Draw, e: Enemy): void {
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
      drawShambler(ctx, e, d, flash);
      break;
    case 'duva':
      drawCrawler(ctx, e, d, flash);
      break;
    case 'skugga':
      drawRunner(ctx, e, d, flash);
      break;
    case 'vaktmastare':
      drawSpitter(ctx, e, d, flash);
      break;
    case 'sparkcykel':
      drawCharger(ctx, e, d, flash);
      break;
    case 'nattvakt':
      drawWarden(ctx, e, d, flash);
      break;
    case 'chauffor':
      drawConductor(ctx, e, d, flash);
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
