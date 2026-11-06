/** In-run HUD (DOM, safe-area aware) and the pause sheet. */

import type { AudioEngine } from '../audio';
import { clockLabel, RUN_DURATION } from '../sim/curve';
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

export function mountHud(deps: HudDeps): Hud {
  const root = el('div', 'hud');
  root.setAttribute('aria-live', 'off');

  const top = el('div', 'hud__top');
  const clockWrap = el('div', 'hud__clock');
  const clock = el('div', 'hud__clock-value', '23:00');
  const night = el('div', 'hud__night', 'NATT 1');
  clockWrap.appendChild(clock);
  clockWrap.appendChild(night);
  top.appendChild(clockWrap);

  const pauseBtn = button('II', {
    variant: 'ghost',
    ariaLabel: 'Pausa',
    onClick: () => deps.onPause(),
  });
  pauseBtn.classList.add('hud__pause');
  top.appendChild(pauseBtn);
  root.appendChild(top);

  const hpWraplabel = el('div', 'hud__barlabel');
  const hpLabel = el('span', 'hud__barlabel-text', 'HP');
  const hpValue = el('span', 'hud__barlabel-value', '100 / 100');
  hpWraplabel.appendChild(hpLabel);
  hpWraplabel.appendChild(hpValue);
  root.appendChild(hpWraplabel);
  const hpBar = bar('bar--hp', 1);
  hpBar.classList.add('hud__bar');
  root.appendChild(hpBar);

  const xpBar = bar('bar--xp', 0);
  xpBar.classList.add('hud__bar', 'hud__bar--thin');
  root.appendChild(xpBar);

  const intel = el('div', 'hud__intel');
  const kills = el('div', 'hud__cell', '0 · 0');
  const level = el('div', 'hud__cell', 'NIV 1');
  const change = el('div', 'hud__cell hud__cell--change', '0 kr');
  intel.appendChild(kills);
  intel.appendChild(level);
  intel.appendChild(change);
  root.appendChild(intel);

  const weapons = el('div', 'hud__weapons');
  root.appendChild(weapons);

  const banner = el('div', 'hud__banner');
  root.appendChild(banner);

  deps.root.appendChild(root);

  // Last written text, so the frame loop only touches the DOM when a value changes.
  const cache = {
    clock: '',
    night: '',
    hp: '',
    hpFill: -1,
    xpFill: -1,
    kills: '',
    level: '',
    change: '',
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

      const hpNow = Math.max(0, Math.ceil(state.player.hp));
      const hpMax = Math.max(1, Math.ceil(state.player.maxHp));
      const hpText = `${hpNow} / ${hpMax}`;
      if (hpText !== cache.hp) {
        hpValue.textContent = hpText;
        cache.hp = hpText;
      }
      const hpFrac = hpNow / hpMax;
      if (Math.abs(hpFrac - cache.hpFill) > 0.004) {
        const fill = hpBar.querySelector<HTMLElement>('.bar__fill');
        if (fill) fill.style.width = `${Math.max(0, Math.min(1, hpFrac)) * 100}%`;
        hpBar.classList.toggle('bar--low', hpFrac <= 0.3);
        cache.hpFill = hpFrac;
      }

      const xpFrac = state.xpToNext > 0 ? state.xp / state.xpToNext : 0;
      if (Math.abs(xpFrac - cache.xpFill) > 0.004) {
        const fill = xpBar.querySelector<HTMLElement>('.bar__fill');
        if (fill) fill.style.width = `${Math.max(0, Math.min(1, xpFrac)) * 100}%`;
        cache.xpFill = xpFrac;
      }

      const killsText = `${fmt(state.kills)} · ${fmt(state.spawn.totalSpawned)}`;
      if (killsText !== cache.kills) {
        kills.textContent = killsText;
        cache.kills = killsText;
      }
      const levelText = `NIV ${state.level}`;
      if (levelText !== cache.level) {
        level.textContent = levelText;
        cache.level = levelText;
      }
      const changeText = `${fmt(state.change)} kr`;
      if (changeText !== cache.change) {
        change.textContent = changeText;
        cache.change = changeText;
      }

      const weaponText = state.weapons
        .map((w) => `${WEAPONS[w.id].name}${w.evolved ? '★' : ` ${w.level}`}`)
        .join(' · ');
      if (weaponText !== cache.weapons) {
        weapons.textContent = weaponText;
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