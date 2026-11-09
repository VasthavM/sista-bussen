/**
 * Debug gallery used by `tools/gallery.mjs`: every zombie, every playable
 * character, the bus, the fuel can and the four pickup icons, at in-game scale
 * and at 2x, plus the flashing variants, on the real asphalt value. The draw
 * path it exercises is the one the game uses.
 */
import { CHARACTERS, ENEMIES } from '../sim/content';
import type { CharacterId, Enemy, EnemyType } from '../sim/types';
import type { Draw } from './draw';
import { drawPlayer } from './entities';
import { drawBus, drawCanister } from './objective';
import { PAL } from './palette';
import { type PickupIcon, drawPickupIcon } from './pickups';
import { drawOneEnemy } from './zombies';

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
const GALLERY_ICONS: PickupIcon[] = ['fuel', 'scrap', 'parts', 'supplies'];

function galleryEnemy(type: EnemyType, flash: boolean, state = 0, timer = 0): Enemy {
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
    phase: 0.6,
    state,
    timer,
    elite: false,
    alpha: 1,
  };
}

export const GALLERY_SIZE = { width: 1760, height: 1060 };

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
    bus: { x: 0, y: 0 },
    quotaMet: false,
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

  const drawEnemy = (e: Enemy, x: number, y: number, scale: number): void => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    drawOneEnemy(d, e);
    ctx.restore();
  };

  const label = (text: string, x: number, y: number, dim = false): void => {
    ctx.fillStyle = dim ? PAL.inkDim : PAL.ink;
    ctx.fillText(text, x, y);
  };

  const row = (title: string, titleY: number, y: number, scale: number, labelDy: number): void => {
    ctx.fillStyle = PAL.inkDim;
    ctx.fillText(title, width / 2, titleY);
    for (let i = 0; i < GALLERY_ENEMIES.length; i++) {
      const type = GALLERY_ENEMIES[i];
      drawEnemy(galleryEnemy(type, false), colX(i), y, scale);
      label(ENEMIES[type].name, colX(i), y + labelDy, scale > 1);
    }
    for (let i = 0; i < GALLERY_CHARS.length; i++) {
      drawChar(GALLERY_CHARS[i], colX(7 + i), y, scale, false);
      label(CHARACTERS[GALLERY_CHARS[i]].name, colX(7 + i), y + labelDy, scale > 1);
    }
  };

  // Row 1: in-game scale. Row 2: 2x inspection.
  row('IN-GAME SCALE · live radius · same draw path as the game', 34, 116, 1, 66);
  row('2x INSPECTION', 248, 384, 2, 100);

  // Row 3: telegraph states, hit flash, at 2x.
  const rowC = 640;
  ctx.fillStyle = PAL.inkDim;
  ctx.fillText('TELEGRAPHS + HIT FLASH · must stay identifiable', width / 2, 546);
  drawEnemy(galleryEnemy('vaktmastare', false, 0, 0.3), colX(0), rowC, 2);
  label('Spitter · spit wind-up', colX(0), rowC + 100, true);
  drawEnemy(galleryEnemy('sparkcykel', false, 1, 0.6), colX(2), rowC, 2);
  label('Charger · lane', colX(2), rowC + 100, true);
  drawEnemy(galleryEnemy('fyllo', true), colX(5), rowC, 2);
  label('Shambler · flash', colX(5), rowC + 100, true);
  drawEnemy(galleryEnemy('skugga', true), colX(6), rowC, 2);
  label('Runner · flash', colX(6), rowC + 100, true);
  drawChar('nattvandraren', colX(8), rowC, 2, true);
  label('Drifter · flash', colX(8), rowC + 100, true);

  // Row 4: the bus (idle and ready), the fuel can and the pickup icons.
  const rowD = 900;
  ctx.fillStyle = PAL.inkDim;
  ctx.fillText('BUS · FUEL CAN · PICKUPS (fuel, scrap, parts, supplies)', width / 2, 800);
  state.quotaMet = false;
  ctx.save();
  ctx.translate(colX(1), rowD);
  ctx.scale(1.3, 1.3);
  drawBus(d);
  ctx.restore();
  label('Bus · waiting', colX(1), rowD + 70, true);
  state.quotaMet = true;
  ctx.save();
  ctx.translate(colX(4) - 20, rowD);
  ctx.scale(1.3, 1.3);
  drawBus(d);
  ctx.restore();
  label('Bus · quota met', colX(4) - 20, rowD + 70, true);
  ctx.save();
  ctx.translate(colX(6), rowD);
  ctx.scale(2, 2);
  drawCanister(d, 0, 0);
  ctx.restore();
  label('Fuel can', colX(6), rowD + 70, true);
  for (let i = 0; i < GALLERY_ICONS.length; i++) {
    const x = colX(7) + i * cell * 0.85;
    drawPickupIcon(ctx, GALLERY_ICONS[i], x, rowD - 14, 34);
    drawPickupIcon(ctx, GALLERY_ICONS[i], x, rowD + 34, 8);
    label(GALLERY_ICONS[i], x, rowD + 70, true);
  }
}
