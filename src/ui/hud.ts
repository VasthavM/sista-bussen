/**
 * The one and only in-run HUD. DOM, because it has to stay crisp, respect the
 * safe-area insets, own the pause button and never clip at the letterbox.
 *
 * Layout intent: the fuel gauge is the goal of the map, so it is the loudest thing on
 * screen, with the elapsed timer and the three material counters under the same panel.
 * When the quota is met a persistent "All aboard" strip appears and an arrow points at
 * the bus whenever it is off screen. Bottom: HP, XP, kills and the weapon rack.
 */
import type { AudioEngine } from '../audio';
import { elapsedLabel } from '../flow';
import { WEAPONS } from '../sim/content';
import type { SimState } from '../sim/types';
import { STOP_INFO, icon, materialChip, MATERIAL_ORDER } from './icons';
import { bar, button, el, fmt } from './kit';
import type { OverlayHandle, OverlayHost } from './overlay';

/** Half the camera frame in world units, so the HUD can tell whether the bus is on screen. */
export interface ViewHalf {
  halfW: number;
  halfH: number;
}

export interface Hud {
  update(state: SimState, view?: ViewHalf): void;
  announce(text: string, kind?: 'boss' | 'good'): void;
  destroy(): void;
}

export interface HudDeps {
  root: HTMLElement;
  onPause: () => void;
}

/** Screen-space inset (px) the bus arrow keeps from the HUD panels at the top and bottom. */
const ARROW_INSET = { x: 34, top: 200, bottom: 150 } as const;

export function mountHud(deps: HudDeps): Hud {
  const root = el('div', 'hud');
  root.setAttribute('aria-live', 'off');

  // ---- top: fuel gauge (the goal), timer, materials ----
  const top = el('div', 'hud__top');
  const panel = el('div', 'hud__panel');
  panel.dataset.hud = 'panel';

  const gaugeRow = el('div', 'hud__gauge-row');
  const fuelIcon = icon('fuel', 'hud__fuel-icon');
  gaugeRow.appendChild(fuelIcon);
  const fuelText = el('span', 'hud__fuel', '0 / 0');
  fuelText.dataset.hud = 'fuel';
  gaugeRow.appendChild(fuelText);
  gaugeRow.appendChild(el('span', 'hud__fuel-label', 'Fuel'));
  const timerWrap = el('span', 'hud__timer-wrap');
  timerWrap.appendChild(icon('clock', 'hud__timer-icon'));
  const timer = el('span', 'hud__timer', '0:00');
  timer.dataset.hud = 'timer';
  timerWrap.appendChild(timer);
  gaugeRow.appendChild(timerWrap);
  panel.appendChild(gaugeRow);

  const gauge = bar('bar--fuel', 0);
  gauge.classList.add('hud__gauge');
  panel.appendChild(gauge);

  const infoRow = el('div', 'hud__info-row');
  const mats = el('div', 'hud__mats');
  mats.dataset.hud = 'materials';
  const matValues = {} as Record<string, HTMLElement>;
  for (const id of MATERIAL_ORDER) {
    const chip = materialChip(id, '0', 'hudmat');
    matValues[id] = chip.querySelector<HTMLElement>('.hudmat__value')!;
    mats.appendChild(chip);
  }
  infoRow.appendChild(mats);
  const where = el('span', 'hud__where', '');
  where.dataset.hud = 'where';
  infoRow.appendChild(where);
  panel.appendChild(infoRow);
  top.appendChild(panel);

  const pauseBtn = button('II', {
    variant: 'ghost',
    ariaLabel: 'Pause',
    onClick: () => deps.onPause(),
  });
  pauseBtn.classList.add('hud__pause');
  top.appendChild(pauseBtn);
  root.appendChild(top);

  // Quota met: a standing instruction, not a banner that fades.
  const goal = el('div', 'hud__goal');
  goal.dataset.hud = 'goal';
  goal.hidden = true;
  goal.appendChild(icon('bus', 'hud__goal-icon'));
  goal.appendChild(el('span', 'hud__goal-text', 'All aboard: get to the bus'));
  root.appendChild(goal);

  // Off-screen bus pointer: a ring with the bus in it and a pointer on the rim.
  const arrow = el('div', 'hud__arrow');
  arrow.dataset.hud = 'bus-arrow';
  arrow.hidden = true;
  const arrowPtr = el('span', 'hud__arrow-ptr');
  arrow.appendChild(arrowPtr);
  arrow.appendChild(icon('bus', 'hud__arrow-icon'));
  root.appendChild(arrow);

  // ---- bottom: the survivable numbers, then the weapon rack ----
  const bottom = el('div', 'hud__bottom');

  const hpRow = el('div', 'hud__row');
  hpRow.dataset.hud = 'hp';
  hpRow.appendChild(el('span', 'hud__key', 'HP'));
  const hpValue = el('span', 'hud__value', '100 / 100');
  hpRow.appendChild(hpValue);
  bottom.appendChild(hpRow);
  const hpBar = bar('bar--hp', 1);
  hpBar.classList.add('hud__bar');
  bottom.appendChild(hpBar);

  const xpRow = el('div', 'hud__row');
  xpRow.dataset.hud = 'xp';
  const level = el('span', 'hud__key hud__key--level', 'LEVEL 1');
  xpRow.appendChild(level);
  const xpValue = el('span', 'hud__value hud__value--xp', '0 / 40 XP');
  xpRow.appendChild(xpValue);
  bottom.appendChild(xpRow);
  const xpBar = bar('bar--xp', 0);
  xpBar.classList.add('hud__bar', 'hud__bar--xp');
  bottom.appendChild(xpBar);

  const intel = el('div', 'hud__intel');
  const kills = el('div', 'hud__cell', 'KILLS 0');
  kills.dataset.hud = 'kills';
  intel.appendChild(kills);
  bottom.appendChild(intel);

  const weapons = el('div', 'hud__weapons');
  weapons.dataset.hud = 'weapons';
  bottom.appendChild(weapons);

  root.appendChild(bottom);

  const banner = el('div', 'hud__banner');
  root.appendChild(banner);

  deps.root.appendChild(root);

  // Last written text, so the frame loop only touches the DOM when a value changes.
  const cache = {
    timer: '',
    where: '',
    hp: '',
    hpFill: -1,
    level: '',
    xp: '',
    xpFill: -1,
    kills: '',
    gauge: -1,
    fuel: '',
    met: false,
    mats: '',
    weapons: '',
    arrow: '',
  };
  let bannerTimer: number | null = null;
  let stageW = 0;
  let stageH = 0;

  function announce(text: string, kind: 'boss' | 'good' = 'boss'): void {
    banner.textContent = text;
    banner.className = `hud__banner hud__banner--${kind} hud__banner--on`;
    if (bannerTimer !== null) window.clearTimeout(bannerTimer);
    bannerTimer = window.setTimeout(() => {
      banner.classList.remove('hud__banner--on');
      bannerTimer = null;
    }, 1800);
  }

  function setFill(node: HTMLElement, frac: number): void {
    const fill = node.querySelector<HTMLElement>('.bar__fill');
    if (fill) fill.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
  }

  /** Place the pointer on the rim of the screen toward the bus, or hide it when the bus is in view. */
  function updateArrow(state: SimState, view: ViewHalf | undefined): void {
    const dx = state.bus.x - state.player.x;
    const dy = state.bus.y - state.player.y;
    const show =
      state.quotaMet && state.status === 'running' && view !== undefined && (Math.abs(dx) > view.halfW - 40 || Math.abs(dy) > view.halfH - 40);
    if (!show || !view) {
      if (!arrow.hidden) {
        arrow.hidden = true;
        cache.arrow = '';
      }
      return;
    }
    if (stageW === 0) {
      stageW = root.clientWidth;
      stageH = root.clientHeight;
    }
    const ang = Math.atan2(dy, dx);
    // Walk from the screen centre along the bearing until it leaves the inset rectangle.
    const cx = stageW / 2;
    const cy = stageH / 2;
    const reachX = cx - ARROW_INSET.x;
    const reachUp = cy - ARROW_INSET.top;
    const reachDown = stageH - ARROW_INSET.bottom - cy;
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    const kx = Math.abs(cos) > 1e-6 ? reachX / Math.abs(cos) : Infinity;
    const ky = Math.abs(sin) > 1e-6 ? (sin < 0 ? reachUp : reachDown) / Math.abs(sin) : Infinity;
    const k = Math.min(kx, ky);
    const x = Math.round(cx + cos * k);
    const y = Math.round(cy + sin * k);
    const key = `${x},${y},${Math.round(ang * 20)}`;
    if (key === cache.arrow) return;
    cache.arrow = key;
    arrow.hidden = false;
    arrow.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    arrowPtr.style.transform = `rotate(${ang}rad) translateX(27px)`;
  }

  return {
    update(state: SimState, view?: ViewHalf): void {
      const stamp = elapsedLabel(state.time);
      if (stamp !== cache.timer) {
        timer.textContent = stamp;
        cache.timer = stamp;
      }
      const stop = state.config.map.stop;
      const whereText = `${STOP_INFO[stop].name} · depth ${state.config.map.depth}`;
      if (whereText !== cache.where) {
        where.textContent = whereText;
        cache.where = whereText;
      }

      const quota = state.config.map.fuelQuota;
      const gaugeFrac = Math.max(0, Math.min(1, state.fuel / Math.max(1, quota)));
      if (Math.abs(gaugeFrac - cache.gauge) > 0.002) {
        setFill(gauge, gaugeFrac);
        cache.gauge = gaugeFrac;
      }
      const fuelLine = `${Math.min(Math.floor(state.fuel), quota)} / ${quota}`;
      if (fuelLine !== cache.fuel) {
        fuelText.textContent = fuelLine;
        cache.fuel = fuelLine;
      }
      if (state.quotaMet !== cache.met) {
        cache.met = state.quotaMet;
        panel.classList.toggle('hud__panel--met', state.quotaMet);
        gauge.classList.toggle('bar--done', state.quotaMet);
        goal.hidden = !state.quotaMet;
      }
      updateArrow(state, view);

      const matText = MATERIAL_ORDER.map((id) => Math.floor(state.materials[id])).join(',');
      if (matText !== cache.mats) {
        cache.mats = matText;
        for (const id of MATERIAL_ORDER) matValues[id].textContent = fmt(state.materials[id]);
      }

      const hpNow = Math.max(0, Math.ceil(state.player.hp));
      const hpMax = Math.max(1, Math.ceil(state.player.maxHp));
      const hpText = `${hpNow} / ${hpMax}`;
      if (hpText !== cache.hp) {
        hpValue.textContent = hpText;
        cache.hp = hpText;
      }
      const hpFrac = hpNow / hpMax;
      if (Math.abs(hpFrac - cache.hpFill) > 0.004) {
        setFill(hpBar, hpFrac);
        hpBar.classList.toggle('bar--low', hpFrac <= 0.3);
        cache.hpFill = hpFrac;
      }

      const levelText = `LEVEL ${state.level}`;
      if (levelText !== cache.level) {
        level.textContent = levelText;
        cache.level = levelText;
      }
      const xpText = `${Math.floor(state.xp)} / ${Math.round(state.xpToNext)} XP`;
      if (xpText !== cache.xp) {
        xpValue.textContent = xpText;
        cache.xp = xpText;
      }
      const xpFrac = state.xpToNext > 0 ? state.xp / state.xpToNext : 0;
      if (Math.abs(xpFrac - cache.xpFill) > 0.004) {
        setFill(xpBar, xpFrac);
        cache.xpFill = xpFrac;
      }

      const killsText = `KILLS ${fmt(state.kills)}`;
      if (killsText !== cache.kills) {
        kills.textContent = killsText;
        cache.kills = killsText;
      }

      const weaponText = state.weapons
        .map((w) => `${w.evolved ? WEAPONS[w.id].evolvedName : WEAPONS[w.id].name} ${w.evolved ? '★' : w.level}`)
        .join(' · ');
      if (weaponText !== cache.weapons) {
        while (weapons.firstChild) weapons.removeChild(weapons.firstChild);
        for (const w of state.weapons) {
          const chip = el('span', `hud__weapon${w.evolved ? ' hud__weapon--evo' : ''}`);
          chip.appendChild(el('span', 'hud__weapon-name', w.evolved ? WEAPONS[w.id].evolvedName : WEAPONS[w.id].name));
          chip.appendChild(el('span', 'hud__weapon-level', w.evolved ? 'MAX' : `LV ${w.level}`));
          weapons.appendChild(chip);
        }
        weapons.hidden = state.weapons.length === 0;
        cache.weapons = weaponText;
      }
    },
    announce,
    destroy(): void {
      if (bannerTimer !== null) window.clearTimeout(bannerTimer);
      if (root.parentNode) root.parentNode.removeChild(root);
    },
  };
}

export interface PauseDeps {
  audio: AudioEngine;
  muted: boolean;
  onToggleMute: () => boolean;
  onResume: () => void;
  onQuit: () => void;
}

export function openPause(host: OverlayHost, deps: PauseDeps): OverlayHandle {
  const root = el('div', 'pause sheet');
  root.appendChild(el('div', 'pause__tag', 'ON HOLD'));
  root.appendChild(el('h2', 'pause__title', 'PAUSED'));
  root.appendChild(el('p', 'pause__text', 'The dead keep walking. You can stop.'));

  const body = el('div', 'pause__body');

  const muteBtn = button(deps.muted ? 'SOUND: OFF' : 'SOUND: ON', {
    variant: 'ghost',
    onClick: () => {
      const muted = deps.onToggleMute();
      muteBtn.querySelector('.btn__label')!.textContent = muted ? 'SOUND: OFF' : 'SOUND: ON';
      deps.audio.play('ui_click');
    },
  });
  body.appendChild(muteBtn);

  body.appendChild(
    button('RESUME', {
      variant: 'primary',
      onClick: () => {
        deps.audio.play('ui_click');
        deps.onResume();
      },
    }),
  );
  body.appendChild(
    button('ABANDON MAP', {
      variant: 'ghost',
      onClick: () => {
        deps.audio.play('ui_click');
        deps.onQuit();
      },
    }),
  );

  root.appendChild(body);
  root.appendChild(el('p', 'pause__hint', 'Esc / P'));
  return host.push(root, { dismissable: true, label: 'Paused', onClose: deps.onResume });
}