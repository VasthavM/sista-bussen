/**
 * Pickup icons: fuel and the three materials. Each is a flat, outlined shape
 * with its own silhouette and its own colour so they never read as one another
 * at gameplay size:
 *
 *   fuel      amber jerry can with a handle and a drop stamp
 *   scrap     blue-steel hex nut
 *   parts     copper cog with six teeth
 *   supplies  pale crate with a green cross
 *
 * Icons are baked once into small canvases and blitted, so a screen full of
 * scrap costs a drawImage per orb. `iconUrl` hands the same bake to DOM UI.
 */
import { PAL, SPRITE_INK } from './palette';
import { TAU } from './shapes';

export type PickupIcon = 'fuel' | 'scrap' | 'parts' | 'supplies';

export const ICON_COLOUR: Record<PickupIcon, string> = {
  fuel: PAL.amber,
  scrap: '#8fb4d6',
  parts: '#e0873a',
  supplies: '#3ddc97',
};

const BAKE = 64;
const cache = new Map<PickupIcon, HTMLCanvasElement>();

function bake(id: PickupIcon): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = BAKE;
  c.height = BAKE;
  const g = c.getContext('2d');
  if (!g) return c;
  g.translate(BAKE / 2, BAKE / 2);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const k = BAKE * 0.4;
  const ol = 5;
  switch (id) {
    case 'fuel': {
      // Jerry can: body, shoulder notch, handle bar and spout.
      g.beginPath();
      g.moveTo(-k * 0.8, -k * 0.5);
      g.lineTo(k * 0.35, -k * 0.5);
      g.lineTo(k * 0.8, -k * 0.1);
      g.lineTo(k * 0.8, k * 0.9);
      g.lineTo(-k * 0.8, k * 0.9);
      g.closePath();
      g.strokeStyle = SPRITE_INK;
      g.lineWidth = ol * 2;
      g.stroke();
      g.fillStyle = PAL.amberDeep;
      g.fill();
      g.fillStyle = PAL.amber;
      g.fillRect(-k * 0.8, -k * 0.5, k * 1.15, k * 0.34);
      // Handle and cap.
      g.strokeStyle = SPRITE_INK;
      g.lineWidth = ol * 1.4;
      g.strokeRect(-k * 0.5, -k * 0.95, k * 0.5, k * 0.45);
      g.fillStyle = PAL.amberWarm;
      g.fillRect(k * 0.42, -k * 0.82, k * 0.3, k * 0.28);
      // Drop stamp.
      g.fillStyle = SPRITE_INK;
      g.beginPath();
      g.moveTo(0, k * 0.1);
      g.quadraticCurveTo(k * 0.42, k * 0.52, 0, k * 0.78);
      g.quadraticCurveTo(-k * 0.42, k * 0.52, 0, k * 0.1);
      g.fill();
      break;
    }
    case 'scrap': {
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + TAU / 12;
        const px = Math.cos(a) * k;
        const py = Math.sin(a) * k;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.strokeStyle = SPRITE_INK;
      g.lineWidth = ol * 2;
      g.stroke();
      g.fillStyle = ICON_COLOUR.scrap;
      g.fill();
      // Bevel and the hole.
      g.strokeStyle = '#e4f1fb';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(-k * 0.85, -k * 0.5);
      g.lineTo(0, -k * 1.0);
      g.lineTo(k * 0.85, -k * 0.5);
      g.stroke();
      g.fillStyle = SPRITE_INK;
      g.beginPath();
      g.arc(0, 0, k * 0.36, 0, TAU);
      g.fill();
      break;
    }
    case 'parts': {
      // Cog: six teeth on a disc, bright hub.
      g.fillStyle = ICON_COLOUR.parts;
      g.strokeStyle = SPRITE_INK;
      for (let i = 0; i < 6; i++) {
        g.save();
        g.rotate((i / 6) * TAU);
        g.lineWidth = ol * 1.6;
        g.strokeRect(-k * 0.2, -k * 1.06, k * 0.4, k * 0.5);
        g.restore();
      }
      g.beginPath();
      g.arc(0, 0, k * 0.78, 0, TAU);
      g.lineWidth = ol * 2;
      g.stroke();
      for (let i = 0; i < 6; i++) {
        g.save();
        g.rotate((i / 6) * TAU);
        g.fillRect(-k * 0.2, -k * 1.06, k * 0.4, k * 0.5);
        g.restore();
      }
      g.beginPath();
      g.arc(0, 0, k * 0.78, 0, TAU);
      g.fill();
      g.fillStyle = SPRITE_INK;
      g.beginPath();
      g.arc(0, 0, k * 0.3, 0, TAU);
      g.fill();
      g.strokeStyle = '#ffd4a0';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(0, 0, k * 0.58, Math.PI * 1.1, Math.PI * 1.7);
      g.stroke();
      break;
    }
    case 'supplies': {
      g.beginPath();
      g.roundRect(-k * 0.92, -k * 0.82, k * 1.84, k * 1.64, k * 0.22);
      g.strokeStyle = SPRITE_INK;
      g.lineWidth = ol * 2;
      g.stroke();
      g.fillStyle = '#dfeee0';
      g.fill();
      g.fillStyle = ICON_COLOUR.supplies;
      g.fillRect(-k * 0.14, -k * 0.52, k * 0.28, k * 1.04);
      g.fillRect(-k * 0.52, -k * 0.14, k * 1.04, k * 0.28);
      g.fillStyle = '#9fb7a2';
      g.fillRect(-k * 0.92, k * 0.5, k * 1.84, k * 0.32);
      break;
    }
  }
  return c;
}

export function iconSprite(id: PickupIcon): HTMLCanvasElement {
  let c = cache.get(id);
  if (!c) {
    c = bake(id);
    cache.set(id, c);
  }
  return c;
}

/** Blit an icon centred at (x, y), `half` px from the centre to the outline edge. */
export function drawPickupIcon(
  ctx: CanvasRenderingContext2D,
  id: PickupIcon,
  x: number,
  y: number,
  half: number,
  angle = 0,
): void {
  const s = iconSprite(id);
  if (angle !== 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.drawImage(s, -half, -half, half * 2, half * 2);
    ctx.restore();
  } else {
    ctx.drawImage(s, x - half, y - half, half * 2, half * 2);
  }
}

/** PNG data URL of an icon, for DOM UI (HUD, summary, shop). Cached by the bake. */
export function iconUrl(id: PickupIcon): string {
  return iconSprite(id).toDataURL('image/png');
}
