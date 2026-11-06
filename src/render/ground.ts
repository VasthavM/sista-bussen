/**
 * The static ground layer. Built once into an offscreen canvas the size of the
 * world and blitted with a camera offset; `invalidateGround()` rebuilds it.
 *
 * Everything baked here is what makes the scene read as "bus stop at night"
 * rather than "dark arena": kerbed road, wet reflection streaks, drains, sodium
 * light pools, a shelter, a vending machine, bins and puddles.
 */
import { WORLD } from '../sim/state';
import { PAL } from './palette';
import { drawGlow, glowSprite, poolSprite } from './sprites';
import { mulberry32, rgba } from './util';

export interface GroundProp {
  x: number;
  y: number;
  radius: number;
  colour: string;
  /** 0..1 base intensity of the per-frame bloom. */
  intensity: number;
}

export const LAMPS: GroundProp[] = [
  { x: 972, y: 402, radius: 96, colour: PAL.amber, intensity: 0.5 },
  { x: 972, y: 742, radius: 96, colour: PAL.amber, intensity: 0.52 },
  { x: 972, y: 1082, radius: 96, colour: PAL.amber, intensity: 0.46 },
  { x: 470, y: 1180, radius: 84, colour: PAL.amberDeep, intensity: 0.32 },
];

export const VENDING = { x: 606, y: 792, w: 48, h: 76, glowX: 596, glowY: 800 };

export const SHELTER = { x: 662, y: 556, w: 224, h: 146 };

export const SIGN = { x: 930, y: 636 };

/** Draw a stretched radial smear — wet reflection of a light source. */
function streak(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  colour: string,
  alpha: number,
): void {
  g.save();
  g.translate(x, y);
  g.scale(1, ry / rx);
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  grad.addColorStop(0, rgba(colour, alpha));
  grad.addColorStop(0.45, rgba(colour, alpha * 0.42));
  grad.addColorStop(1, rgba(colour, 0));
  g.fillStyle = grad;
  g.beginPath();
  g.arc(0, 0, rx, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function puddle(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rnd: () => number): void {
  g.save();
  g.translate(x, y);
  g.rotate((rnd() - 0.5) * 0.5);

  // Dark, near-black water body with a slightly blue rim.
  g.fillStyle = '#05080c';
  g.beginPath();
  g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  g.fill();

  g.strokeStyle = rgba(PAL.fluoro, 0.14);
  g.lineWidth = 1.4;
  g.beginPath();
  g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  g.stroke();

  // Lamps reflected inside the water, stretched along the y axis.
  const rl = g.createLinearGradient(0, -ry, 0, ry);
  rl.addColorStop(0, rgba(PAL.amber, 0.02));
  rl.addColorStop(0.5, rgba(PAL.amber, 0.16));
  rl.addColorStop(1, rgba(PAL.amber, 0.03));
  g.fillStyle = rl;
  g.beginPath();
  g.ellipse(0, 0, rx * 0.72, ry * 0.82, 0, 0, Math.PI * 2);
  g.fill();

  g.strokeStyle = rgba('#ffffff', 0.09);
  g.lineWidth = 1;
  g.beginPath();
  g.ellipse(0, -ry * 0.12, rx * 0.62, ry * 0.55, 0, Math.PI * 1.05, Math.PI * 1.85);
  g.stroke();

  g.restore();
}

function drain(g: CanvasRenderingContext2D, x: number, y: number): void {
  g.fillStyle = '#04060a';
  g.fillRect(x - 13, y - 9, 26, 18);
  g.strokeStyle = rgba(PAL.kerb, 0.9);
  g.lineWidth = 1.5;
  g.strokeRect(x - 13, y - 9, 26, 18);
  g.strokeStyle = rgba('#000000', 0.7);
  g.lineWidth = 2;
  for (let i = -8; i <= 8; i += 4) {
    g.beginPath();
    g.moveTo(x + i, y - 7);
    g.lineTo(x + i, y + 7);
    g.stroke();
  }
}

function shelter(g: CanvasRenderingContext2D): void {
  const { x, y, w, h } = SHELTER;
  // Cast shadow to the left of the lamps.
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.fillRect(x - 12, y + 10, w, h);

  // Concrete pad.
  g.fillStyle = '#11161d';
  g.fillRect(x - 8, y - 8, w + 16, h + 16);
  g.strokeStyle = rgba(PAL.kerb, 0.75);
  g.lineWidth = 2;
  g.strokeRect(x - 8, y - 8, w + 16, h + 16);

  // Roof: dark steel frame with a translucent green glass panel.
  g.fillStyle = '#0d1219';
  g.fillRect(x, y, w, h);

  const glass = g.createLinearGradient(x, y, x + w, y + h);
  glass.addColorStop(0, rgba(PAL.green, 0.2));
  glass.addColorStop(0.5, rgba(PAL.fluoroDeep, 0.14));
  glass.addColorStop(1, rgba(PAL.green, 0.06));
  g.fillStyle = glass;
  g.fillRect(x + 7, y + 7, w - 14, h - 14);

  // Frame ribs.
  g.strokeStyle = rgba(PAL.steel, 0.22);
  g.lineWidth = 2;
  for (let i = 1; i < 4; i++) {
    g.beginPath();
    g.moveTo(x + (w / 4) * i, y);
    g.lineTo(x + (w / 4) * i, y + h);
    g.stroke();
  }
  g.beginPath();
  g.moveTo(x, y + h / 2);
  g.lineTo(x + w, y + h / 2);
  g.stroke();

  // Bus green illuminated edge strip along the sign side of the roof.
  g.fillStyle = rgba(PAL.green, 0.85);
  g.fillRect(x + w - 6, y + 4, 3, h - 8);
  g.strokeStyle = rgba(PAL.green, 0.35);
  g.lineWidth = 2;
  g.strokeRect(x, y, w, h);

  // Bench under the roof.
  g.fillStyle = '#241c14';
  g.fillRect(x + 26, y + h - 46, 118, 16);
  g.fillStyle = '#3a2d1d';
  g.fillRect(x + 26, y + h - 46, 118, 4);
  g.fillStyle = rgba('#000000', 0.5);
  g.fillRect(x + 30, y + h - 30, 8, 10);
  g.fillRect(x + 132, y + h - 30, 8, 10);

  // Litter under the bench.
  g.fillStyle = rgba(PAL.ink, 0.12);
  g.beginPath();
  g.arc(x + 60, y + h - 16, 3, 0, Math.PI * 2);
  g.arc(x + 74, y + h - 20, 2, 0, Math.PI * 2);
  g.arc(x + 108, y + h - 14, 2.5, 0, Math.PI * 2);
  g.fill();
}

function vendingMachine(g: CanvasRenderingContext2D): void {
  const { x, y, w, h } = VENDING;
  g.fillStyle = 'rgba(0,0,0,0.5)';
  g.fillRect(x + 6, y + 8, w, h);

  g.fillStyle = '#161b22';
  g.fillRect(x, y, w, h);
  g.strokeStyle = rgba(PAL.steel, 0.28);
  g.lineWidth = 2;
  g.strokeRect(x, y, w, h);

  // Lit front panel.
  const panel = g.createLinearGradient(x, y, x + w * 0.6, y + h);
  panel.addColorStop(0, rgba(PAL.fluoro, 0.5));
  panel.addColorStop(0.6, rgba(PAL.fluoro, 0.18));
  panel.addColorStop(1, rgba(PAL.fluoro, 0.05));
  g.fillStyle = panel;
  g.fillRect(x + 5, y + 6, w - 18, h - 26);

  // Product rows silhouetted against the panel.
  g.fillStyle = rgba('#04070a', 0.75);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 2; c++) {
      g.fillRect(x + 9 + c * 10, y + 11 + r * 10, 6, 6);
    }
  }

  // Coin slot + dispenser tray.
  g.fillStyle = rgba(PAL.amber, 0.85);
  g.fillRect(x + w - 11, y + 14, 4, 10);
  g.fillStyle = '#05080c';
  g.fillRect(x + 6, y + h - 16, w - 12, 9);
  g.strokeStyle = rgba(PAL.steel, 0.2);
  g.lineWidth = 1;
  g.strokeRect(x + 6, y + h - 16, w - 12, 9);
}

function bins(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  g.fillStyle = 'rgba(0,0,0,0.5)';
  g.beginPath();
  g.arc(x + 4, y + 5, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#1a2a22';
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = rgba(PAL.green, 0.4);
  g.lineWidth = 2;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#0a1410';
  g.beginPath();
  g.arc(x, y, r * 0.6, 0, Math.PI * 2);
  g.fill();
}

function buildGround(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = WORLD.w;
  canvas.height = WORLD.h;
  const g = canvas.getContext('2d');
  if (!g) return canvas;
  const rnd = mulberry32(0x51f7a3);

  // --- base asphalt -------------------------------------------------------
  g.fillStyle = PAL.asphalt;
  g.fillRect(0, 0, WORLD.w, WORLD.h);

  // Large mottling so the ground is not a flat colour.
  for (let i = 0; i < 260; i++) {
    const x = rnd() * WORLD.w;
    const y = rnd() * WORLD.h;
    const r = 40 + rnd() * 180;
    const light = rnd() > 0.5;
    streak(g, x, y, r, r * (0.6 + rnd() * 0.9), light ? '#141b24' : '#070a0e', 0.5 + rnd() * 0.3);
  }

  // Verge left of the pavement: dirt and grit.
  g.fillStyle = '#0a0d10';
  g.fillRect(0, 0, 560, WORLD.h);
  for (let i = 0; i < 2400; i++) {
    const x = rnd() * 560;
    const y = rnd() * WORLD.h;
    g.fillStyle = rgba(rnd() > 0.5 ? '#1c242c' : '#05070a', 0.4 + rnd() * 0.4);
    g.fillRect(x, y, 2, 2);
  }

  // --- bus stop pavement --------------------------------------------------
  const padX = 560;
  const padW = 440;
  const padY = 372;
  const padH = 660;
  g.fillStyle = PAL.slab;
  g.fillRect(padX, padY, padW, padH);

  // Paving slabs.
  const slabW = 44;
  const slabH = 44;
  for (let y = padY; y < padY + padH; y += slabH) {
    for (let x = padX; x < padX + padW; x += slabW) {
      const v = rnd();
      if (v > 0.72) {
        g.fillStyle = rgba('#1a2129', 0.55);
        g.fillRect(x + 1, y + 1, slabW - 2, slabH - 2);
      } else if (v < 0.16) {
        g.fillStyle = rgba('#0c1015', 0.5);
        g.fillRect(x + 1, y + 1, slabW - 2, slabH - 2);
      }
    }
  }
  g.strokeStyle = rgba(PAL.slabLine, 0.9);
  g.lineWidth = 1.5;
  for (let x = padX; x <= padX + padW; x += slabW) {
    g.beginPath();
    g.moveTo(x, padY);
    g.lineTo(x, padY + padH);
    g.stroke();
  }
  for (let y = padY; y <= padY + padH; y += slabH) {
    g.beginPath();
    g.moveTo(padX, y);
    g.lineTo(padX + padW, y);
    g.stroke();
  }
  g.strokeStyle = rgba(PAL.kerb, 0.9);
  g.lineWidth = 3;
  g.strokeRect(padX, padY, padW, padH);

  // Wet patches on the pavement.
  for (let i = 0; i < 18; i++) {
    streak(
      g,
      padX + rnd() * padW,
      padY + rnd() * padH,
      30 + rnd() * 90,
      18 + rnd() * 70,
      '#1b2530',
      0.35,
    );
  }

  // --- road -------------------------------------------------------------
  g.fillStyle = '#070a0e';
  g.fillRect(1000, 0, WORLD.w - 1000, WORLD.h);
  for (let i = 0; i < 5200; i++) {
    const x = 1000 + rnd() * (WORLD.w - 1000);
    const y = rnd() * WORLD.h;
    g.fillStyle = rgba(rnd() > 0.45 ? '#101720' : '#03050a', 0.3 + rnd() * 0.5);
    g.fillRect(x, y, 2 + (rnd() > 0.9 ? 2 : 0), 2);
  }

  // Wet reflection streaks running down the road from the lamps.
  for (const lamp of LAMPS) {
    for (let i = 0; i < 7; i++) {
      const rx = 16 + rnd() * 46;
      streak(
        g,
        1004 + rnd() * 380,
        lamp.y - 160 + rnd() * 340,
        rx,
        rx * (2.2 + rnd() * 2.6),
        PAL.amber,
        0.16 + rnd() * 0.16,
      );
    }
    streak(g, 1004 + rnd() * 180, lamp.y, 120, 340, PAL.amberDeep, 0.1);
  }
  // Cold fluorescent smear from the vending machine across the slabs.
  streak(g, 660, 850, 150, 300, PAL.fluoro, 0.07);

  // Lane markings: dashed centre line plus the bus stop bay box.
  g.fillStyle = rgba(PAL.ink, 0.3);
  for (let y = -20; y < WORLD.h; y += 96) {
    g.fillRect(1190, y, 6, 54);
  }
  g.fillStyle = rgba(PAL.amberWarm, 0.22);
  g.fillRect(1024, 0, 5, WORLD.h);

  // Bus stop bay: solid yellow outline on the far side of the kerb.
  g.strokeStyle = rgba(PAL.amberWarm, 0.3);
  g.lineWidth = 4;
  g.strokeRect(1040, 520, 150, 380);
  g.font = 'bold 26px ui-monospace, SFMono-Regular, Menlo, monospace';
  g.fillStyle = rgba(PAL.amberWarm, 0.24);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.save();
  g.translate(1115, 470);
  g.fillText('BUSS', 0, 0);
  g.restore();

  // --- kerb + drains ----------------------------------------------------
  g.fillStyle = PAL.kerb;
  g.fillRect(986, 0, 16, WORLD.h);
  g.fillStyle = rgba('#2b3440', 0.9);
  g.fillRect(986, 0, 4, WORLD.h);
  g.fillStyle = rgba('#000000', 0.5);
  g.fillRect(998, 0, 4, WORLD.h);
  for (let y = 0; y < WORLD.h; y += 58) {
    g.fillStyle = rgba('#0e141b', 0.85);
    g.fillRect(986, y, 16, 26);
  }
  drain(g, 994, 486);
  drain(g, 994, 812);
  drain(g, 994, 1136);

  // --- wet street furniture --------------------------------------------
  puddle(g, 742, 906, 104, 52, rnd);
  puddle(g, 872, 470, 74, 34, rnd);
  puddle(g, 618, 1058, 86, 40, rnd);
  puddle(g, 1108, 728, 148, 74, rnd);
  puddle(g, 1236, 300, 96, 46, rnd);
  puddle(g, 706, 604, 58, 26, rnd);
  puddle(g, 404, 806, 120, 58, rnd);

  // Grit and cigarette ends on the slabs.
  for (let i = 0; i < 260; i++) {
    const x = padX + rnd() * padW;
    const y = padY + rnd() * padH;
    g.fillStyle = rgba(rnd() > 0.85 ? PAL.amberWarm : '#28313a', 0.5 + rnd() * 0.4);
    const s = rnd() > 0.9 ? 3 : 2;
    g.fillRect(x, y, s, s);
  }

  // --- set dressing -----------------------------------------------------
  shelter(g);
  vendingMachine(g);
  bins(g, 906, 508, 17);
  bins(g, 938, 546, 13);
  bins(g, 566, 466, 15);

  // Bus stop sign pole.
  g.fillStyle = rgba('#000000', 0.55);
  g.beginPath();
  g.arc(SIGN.x + 4, SIGN.y + 6, 9, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#20262e';
  g.beginPath();
  g.arc(SIGN.x, SIGN.y, 8, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = rgba(PAL.green, 0.9);
  g.fillRect(SIGN.x - 14, SIGN.y - 22, 28, 15);
  g.strokeStyle = rgba('#04120b', 0.8);
  g.lineWidth = 2;
  g.strokeRect(SIGN.x - 14, SIGN.y - 22, 28, 15);
  g.fillStyle = rgba('#04120b', 0.9);
  g.font = 'bold 10px ui-monospace, monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('H', SIGN.x, SIGN.y - 14);

  // --- sodium lamps: baked pools of amber light -------------------------
  for (const lamp of LAMPS) {
    streak(g, lamp.x, lamp.y, 250, 210, PAL.amber, 0.2);
    streak(g, lamp.x, lamp.y, 120, 120, PAL.amberWarm, 0.16);
    // Pole and head.
    g.fillStyle = rgba('#000000', 0.6);
    g.beginPath();
    g.arc(lamp.x + 5, lamp.y + 7, 12, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#161c24';
    g.beginPath();
    g.arc(lamp.x, lamp.y, 11, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = rgba(PAL.amberDeep, 0.7);
    g.lineWidth = 2;
    g.beginPath();
    g.arc(lamp.x, lamp.y, 11, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = PAL.amberWarm;
    g.beginPath();
    g.arc(lamp.x, lamp.y, 6, 0, Math.PI * 2);
    g.fill();
  }

  // --- fine grain over the whole layer ---------------------------------
  for (let i = 0; i < 14000; i++) {
    const x = rnd() * WORLD.w;
    const y = rnd() * WORLD.h;
    g.fillStyle = rgba(rnd() > 0.5 ? '#1a242e' : '#04060a', 0.16 + rnd() * 0.2);
    g.fillRect(x, y, 2, 2);
  }

  // --- world edge: the world simply falls away into the dark ------------
  const edge = g.createLinearGradient(0, 0, 0, 200);
  edge.addColorStop(0, 'rgba(3,5,8,0.85)');
  edge.addColorStop(1, 'rgba(3,5,8,0)');
  g.fillStyle = edge;
  g.fillRect(0, 0, WORLD.w, 200);

  return canvas;
}

let groundCache: HTMLCanvasElement | null = null;

export function groundLayer(): HTMLCanvasElement {
  if (!groundCache) groundCache = buildGround();
  return groundCache;
}

export function invalidateGroundLayer(): void {
  groundCache = null;
}

/** Per-frame emissive blooms for the baked props, drawn additively in world space. */
export function drawGroundBloom(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
  halfW: number,
  halfH: number,
  t: number,
): void {
  for (let i = 0; i < LAMPS.length; i++) {
    const lamp = LAMPS[i];
    if (Math.abs(lamp.x - camX) > halfW + 220 || Math.abs(lamp.y - camY) > halfH + 220) continue;
    const flicker = 0.82 + 0.18 * Math.sin(t * 2.1 + i * 2.3) * Math.sin(t * 0.7 + i);
    drawGlow(ctx, glowSprite(lamp.colour), lamp.x, lamp.y, 150, lamp.intensity * flicker);
    drawGlow(ctx, poolSprite(lamp.colour), lamp.x, lamp.y, 250, lamp.intensity * 0.5 * flicker);
  }
  if (Math.abs(VENDING.x - camX) < halfW + 160 && Math.abs(VENDING.y - camY) < halfH + 160) {
    const hum = 0.86 + 0.14 * Math.sin(t * 9.3);
    drawGlow(ctx, glowSprite(PAL.fluoro), VENDING.glowX, VENDING.glowY, 74, 0.24 * hum);
  }
  if (Math.abs(SIGN.x - camX) < halfW + 120 && Math.abs(SIGN.y - camY) < halfH + 120) {
    drawGlow(ctx, glowSprite(PAL.green), SIGN.x, SIGN.y - 16, 46, 0.22);
  }
}