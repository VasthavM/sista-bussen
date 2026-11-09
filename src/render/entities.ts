/**
 * The player: three flat vector silhouettes with a dark outline and a
 * leading-edge rim light. Zombies live in `zombies.ts`, shared primitives in
 * `shapes.ts`.
 *
 * Readability rules for this file:
 *  - Every character is a *person shape* first: coat, shoulder bar, arms, and a
 *    head that protrudes past the shoulder line, with a hand doing something.
 *    Limbs are tapered wedges, never round-capped tubes: tubes read as sausages
 *    at 40px.
 *  - Each silhouette is built from two tones of its own colour plus one prop
 *    colour, so the parts separate at sprite scale without extra detail.
 *  - A hit flash lightens the entity's own colours (see `CHAR_PAINT` flash
 *    variants); it never paints over the dark outline, the face structure or the
 *    accent, so a flashing entity stays recognisable.
 *  - No gradients, no filters, no per-frame string building: every colour is
 *    precomputed in `palette.ts` and every path is drawn per frame.
 */
import type { Draw } from './draw';
import { CHAR_ART, CHAR_PAINT, PAL, WEAPON_LOOK } from './palette';
import type { SpritePaint } from './palette';
import { drawGlow, glowSprite } from './sprites';
import { TAU, disc, discSolid, headMass, plate, seal, taper } from './shapes';

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
      // Chain wrench: a short chain from the fist to the jaw.
      ctx.strokeStyle = PAL.steel;
      ctx.lineWidth = 1.6 * d.inv;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + r * 0.32, hy + r * 0.2);
      ctx.stroke();
      ctx.save();
      ctx.translate(hx + r * 0.4, hy + r * 0.24);
      ctx.rotate(0.9);
      ctx.fillStyle = hot;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#0b0e12';
      ctx.fillRect(-r * 0.26, -r * 0.07, r * 0.2, r * 0.14);
      ctx.fillStyle = hot;
      ctx.fillRect(r * 0.1, -r * 0.08, r * 0.46, r * 0.16);
      ctx.restore();
      break;
    }
    case 'korv': {
      // Nail gun: dark body, hot muzzle, a grip.
      ctx.save();
      ctx.translate(hx + r * 0.2, hy + r * 0.04);
      ctx.fillStyle = '#10161d';
      ctx.fillRect(-r * 0.12, -r * 0.14, r * 0.62, r * 0.24);
      ctx.fillRect(-r * 0.04, r * 0.06, r * 0.16, r * 0.26);
      ctx.fillStyle = core;
      ctx.fillRect(-r * 0.12, -r * 0.14, r * 0.62, r * 0.06);
      ctx.fillStyle = hot;
      ctx.fillRect(r * 0.46, -r * 0.08, r * 0.1, r * 0.12);
      ctx.restore();
      break;
    }
    case 'telefon': {
      // Taser: yellow-blue block with two prongs and a spark between them.
      ctx.save();
      ctx.translate(hx + r * 0.22, hy + r * 0.02);
      ctx.fillStyle = '#0b1017';
      ctx.beginPath();
      ctx.roundRect(-r * 0.14, -r * 0.18, r * 0.5, r * 0.34, r * 0.06);
      ctx.fill();
      ctx.fillStyle = hot;
      ctx.fillRect(-r * 0.08, -r * 0.12, r * 0.2, r * 0.12);
      ctx.fillStyle = PAL.steel;
      ctx.fillRect(r * 0.36, -r * 0.14, r * 0.26, r * 0.05);
      ctx.fillRect(r * 0.36, r * 0.07, r * 0.26, r * 0.05);
      ctx.strokeStyle = hot;
      ctx.lineWidth = 1.2 * d.inv;
      ctx.beginPath();
      ctx.moveTo(r * 0.6, -r * 0.1);
      ctx.lineTo(r * 0.54, -r * 0.02);
      ctx.lineTo(r * 0.62, r * 0.02);
      ctx.lineTo(r * 0.56, r * 0.09);
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'spray': {
      // Torch spray: a can with a lit nozzle and a flame cone.
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.roundRect(hx + r * 0.1, hy - r * 0.12, r * 0.22, r * 0.4, r * 0.06);
      ctx.fill();
      ctx.fillStyle = hot;
      ctx.fillRect(hx + r * 0.28, hy - r * 0.06, r * 0.1, r * 0.12);
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = PAL.amber;
      ctx.beginPath();
      ctx.moveTo(hx + r * 0.42, hy - r * 0.06);
      ctx.lineTo(hx + r * 0.95, hy - r * 0.3);
      ctx.lineTo(hx + r * 0.95, hy + r * 0.18);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = PAL.amberWarm;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.moveTo(hx + r * 0.42, hy);
      ctx.lineTo(hx + r * 0.72, hy - r * 0.1);
      ctx.lineTo(hx + r * 0.72, hy + r * 0.08);
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
