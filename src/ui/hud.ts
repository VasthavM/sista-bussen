/**
 * The one and only in-run HUD. DOM, because it has to stay crisp, respect the
 * safe-area insets, own the pause button and never clip at the letterbox.
 *
 * Layout intent (DESIGN.md §5): the clock and the night bar are the loudest
 * things on screen — they are the goal of the run. Under it the survivable
 * numbers (HP, XP, level, kills, Växel) and the weapon rack, all labelled in
 * Swedish so no number is ever ambiguous, all legible at 30% brightness.
 */
import type { AudioEngine } from '../audio';
import { clockLabel, BOSS_CHAUFFOR_AT, BOSS_NATTVAKT_AT, RUN_DURATION } from '../sim/curve';
import { WEAPONS } from '../sim/content';
import type { SimState } from '../sim/types';
import { bar, button, el, fmt } from './kit';
import type { OverlayHandle, OverlayHost } from './overlay';

export interface Hud {
  update(state: SimState): void;
  announce(text: string, kind?: 'boss' | 'good'): void;
  destroy(): void;
}

export interface HudDeps {
  root: HTMLElement;
  onPause: () => void;
}

interface BossMark {
  at: number;
  label: string;
  className: string;
}

/** Both boss slots on the night bar, positioned from the sim curve. */
const BOSS_MARKS: BossMark[] = [
  { at: BOSS_NATTVAKT_AT, label: 'NATTVAKT', className: 'hud__tick--nattvakt' },
  { at: BOSS_CHAUFFOR_AT, label: 'CHAUFFÖR', className: 'hud__tick--chauffor' },
];

export function mountHud(deps: HudDeps): Hud {
  const root = el('div', 'hud');
  root.setAttribute('aria-live', 'off');

  // ---- top: clock, night, the bar that is the win condition ----
  const top = el('div', 'hud__top');
  const clockPanel = el('div', 'hud__clock');
  clockPanel.dataset.hud = 'clock';

  const clockRow = el('div', 'hud__clock-row');
  const clock = el('div', 'hud__clock-value', '23:00');
  const night = el('div', 'hud__night', 'NATT 1');
  clockRow.appendChild(clock);
  clockRow.appendChild(night);
  clockPanel.appendChild(clockRow);

  const nightBar = el('div', 'hud__nightbar');
  const progress = bar('bar--night', 0);
  progress.classList.add('hud__nightbar-track');
  nightBar.appendChild(progress);
  for (const mark of BOSS_MARKS) {
    const tick = el('span', `hud__tick ${mark.className}`);
    tick.style.left = `${(mark.at / RUN_DURATION) * 100}%`;
    nightBar.appendChild(tick);
  }
  clockPanel.appendChild(nightBar);

  const marks = el('div', 'hud__marks');
  for (const mark of BOSS_MARKS) {
    const item = el('span', `hud__mark ${mark.className.replace('tick', 'mark')}`);
    item.appendChild(el('span', 'hud__mark-time', clockLabel(mark.at)));
    item.appendChild(el('span', 'hud__mark-name', mark.label));
    marks.appendChild(item);
  }
  marks.appendChild(el('span', 'hud__bus', `BUSS ${clockLabel(RUN_DURATION)}`));
  clockPanel.appendChild(marks);
  top.appendChild(clockPanel);

  const pauseBtn = button('II', {
    variant: 'ghost',
    ariaLabel: 'Pausa',
    onClick: () => deps.onPause(),
  });
  pauseBtn.classList.add('hud__pause');
  top.appendChild(pauseBtn);
  root.appendChild(top);

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
  const level = el('span', 'hud__key hud__key--level', 'NIVÅ 1');
  xpRow.appendChild(level);
  const xpValue = el('span', 'hud__value hud__value--xp', '0 / 40 XP');
  xpRow.appendChild(xpValue);
  bottom.appendChild(xpRow);
  const xpBar = bar('bar--xp', 0);
  xpBar.classList.add('hud__bar', 'hud__bar--xp');
  bottom.appendChild(xpBar);

  const intel = el('div', 'hud__intel');
  const kills = el('div', 'hud__cell', 'DÖDA 0');
  kills.dataset.hud = 'kills';
  const change = el('div', 'hud__cell hud__cell--change', 'VÄXEL 0 kr');
  change.dataset.hud = 'change';
  intel.appendChild(kills);
  intel.appendChild(change);
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
    clock: '',
    night: '',
    hp: '',
    hpFill: -1,
    level: '',
    xp: '',
    xpFill: -1,
    kills: '',
    change: '',
    progress: -1,
    weapons: '',
  };
  let bannerTimer: number | null = null;

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

  return {
    update(state: SimState): void {
      const stamp = clockLabel(state.time);
      if (stamp !== cache.clock) {
        clock.textContent = stamp;
        cache.clock = stamp;
      }
      const nightText = `NATT ${state.config.night}`;
      if (nightText !== cache.night) {
        night.textContent = nightText;
        cache.night = nightText;
      }

      const progressFrac = Math.max(0, Math.min(1, state.time / RUN_DURATION));
      if (Math.abs(progressFrac - cache.progress) > 0.002) {
        setFill(progress, progressFrac);
        clockPanel.classList.toggle('hud__clock--late', progressFrac >= 0.75);
        cache.progress = progressFrac;
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

      const levelText = `NIVÅ ${state.level}`;
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

      const killsText = `DÖDA ${fmt(state.kills)}`;
      if (killsText !== cache.kills) {
        kills.textContent = killsText;
        cache.kills = killsText;
      }
      const changeText = `VÄXEL ${fmt(state.change)} kr`;
      if (changeText !== cache.change) {
        change.textContent = changeText;
        cache.change = changeText;
      }

      const weaponText = state.weapons
        .map((w) => `${w.evolved ? WEAPONS[w.id].evolvedName : WEAPONS[w.id].name} ${w.evolved ? '★' : w.level}`)
        .join(' · ');
      if (weaponText !== cache.weapons) {
        while (weapons.firstChild) weapons.removeChild(weapons.firstChild);
        for (const w of state.weapons) {
          const chip = el('span', `hud__weapon${w.evolved ? ' hud__weapon--evo' : ''}`);
          chip.appendChild(el('span', 'hud__weapon-name', w.evolved ? WEAPONS[w.id].evolvedName : WEAPONS[w.id].name));
          chip.appendChild(el('span', 'hud__weapon-level', w.evolved ? 'MAX' : `NIV ${w.level}`));
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
  root.appendChild(el('div', 'pause__tag', 'HÅLLPLATSEN'));
  root.appendChild(el('h2', 'pause__title', 'PAUS'));
  root.appendChild(el('p', 'pause__text', 'Bussen väntar inte. Men det gör den här skärmen.'));

  const progress = bar('bar--night', 0);

  const body = el('div', 'pause__body');
  body.appendChild(progress);

  const muteBtn = button(deps.muted ? 'LJUD: AV' : 'LJUD: PÅ', {
    variant: 'ghost',
    onClick: () => {
      const muted = deps.onToggleMute();
      muteBtn.querySelector('.btn__label')!.textContent = muted ? 'LJUD: AV' : 'LJUD: PÅ';
      deps.audio.play('ui_click');
    },
  });
  body.appendChild(muteBtn);

  body.appendChild(
    button('FORTSÄTT', {
      variant: 'primary',
      onClick: () => {
        deps.audio.play('ui_click');
        deps.onResume();
      },
    }),
  );
  body.appendChild(
    button('AVBRYT RUNDAN', {
      variant: 'ghost',
      onClick: () => {
        deps.audio.play('ui_click');
        deps.onQuit();
      },
    }),
  );

  root.appendChild(body);
  root.appendChild(el('p', 'pause__hint', 'Esc / P'));
  return host.push(root, { dismissable: true, label: 'Paus', onClose: deps.onResume });
}