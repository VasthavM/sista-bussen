/** Settings: mute, motion, haptics, save reset, version. */

import type { AudioEngine } from '../audio';
import type { Profile } from '../meta/save';
import { button, el, toast } from './kit';
import { playColdOpen } from './intro';
import type { OverlayHandle, OverlayHost } from './overlay';

export const REDUCE_MOTION_KEY = 'sista-bussen.reduce-motion.v1';

export function reduceMotionEnabled(): boolean {
  try {
    return localStorage.getItem(REDUCE_MOTION_KEY) === '1';
  } catch {
    return false;
  }
}

export function applyReduceMotion(enabled: boolean): void {
  try {
    localStorage.setItem(REDUCE_MOTION_KEY, enabled ? '1' : '0');
  } catch {
    /* storage may be unavailable */
  }
  document.documentElement.classList.toggle('reduce-motion', enabled);
}

export interface SettingsDeps {
  host: OverlayHost;
  profile: Profile;
  audio: AudioEngine;
  version: string;
  /** Live version updates while the sheet is open (a service worker build change). */
  subscribeVersion?: (listener: (line: string) => void) => () => void;
  persist(): void;
  onReset(): void;
  onChanged(): void;
}

export function openSettings(deps: SettingsDeps): OverlayHandle {
  const root = el('div', 'settings sheet');
  let versionNode: HTMLElement | null = null;
  const unsubscribeVersion = deps.subscribeVersion?.((line: string) => {
    if (versionNode) versionNode.textContent = `ZOMBUS · ${line}`;
  });
  const handle: OverlayHandle = deps.host.push(root, {
    dismissable: true,
    label: 'Settings',
    onClose: () => unsubscribeVersion?.(),
  });

  const head = el('div', 'sheet__head');
  head.appendChild(el('h2', 'sheet__title', 'SETTINGS'));
  head.appendChild(el('p', 'sheet__sub', 'No account. No cloud. Just your phone.'));
  root.appendChild(head);

  const body = el('div', 'sheet__body');
  root.appendChild(body);

  const foot = el('div', 'sheet__footer');
  foot.appendChild(
    button('CLOSE', {
      variant: 'ghost',
      onClick: () => {
        deps.audio.play('ui_click');
        handle.close();
      },
    }),
  );
  root.appendChild(foot);

  let confirmingReset = false;

  function toggleRow(
    title: string,
    description: string,
    on: boolean,
    onToggle: (next: boolean) => void,
  ): HTMLElement {
    const wrap = el('div', 'setting');
    const info = el('div', 'setting__info');
    info.appendChild(el('div', 'setting__title', title));
    info.appendChild(el('div', 'setting__desc', description));
    wrap.appendChild(info);
    const btn = button(on ? 'ON' : 'OFF', {
      variant: on ? 'primary' : 'ghost',
      onClick: () => {
        deps.audio.play('ui_click');
        onToggle(!on);
      },
    });
    btn.classList.add('setting__toggle');
    wrap.appendChild(btn);
    return wrap;
  }

  function render(): void {
    while (body.firstChild) body.removeChild(body.firstChild);

    body.appendChild(
      toggleRow('Sound', 'All sound is synthesised. No files to download.', !deps.profile.settings.muted, (next) => {
        deps.profile.settings.muted = !next;
        deps.audio.setMuted(!next);
        deps.persist();
        render();
      }),
    );

    body.appendChild(
      toggleRow(
        'Reduce motion',
        'Turns off shakes and animations in the interface.',
        reduceMotionEnabled(),
        (next) => {
          applyReduceMotion(next);
          render();
        },
      ),
    );

    body.appendChild(
      toggleRow('Vibration', 'Short pulses on hits, if your phone supports it.', deps.profile.settings.haptics, (next) => {
        deps.profile.settings.haptics = next;
        deps.persist();
        if (next && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(12);
        render();
      }),
    );

    const replay = el('div', 'setting');
    const replayInfo = el('div', 'setting__info');
    replayInfo.appendChild(el('div', 'setting__title', 'Intro'));
    replayInfo.appendChild(el('div', 'setting__desc', 'Watch the opening again.'));
    replay.appendChild(replayInfo);
    const replayBtn = button('REPLAY', {
      variant: 'ghost',
      onClick: () => {
        deps.audio.play('ui_click');
        handle.close();
        playColdOpen();
      },
    });
    replayBtn.classList.add('setting__toggle');
    replay.appendChild(replayBtn);
    body.appendChild(replay);

    const danger = el('div', 'setting setting--danger');
    const info = el('div', 'setting__info');
    info.appendChild(el('div', 'setting__title', 'Reset save'));
    info.appendChild(
      el('div', 'setting__desc', confirmingReset ? 'Sure? All scrap and unlocked nights are gone.' : 'Starts over from night 1. Cannot be undone.'),
    );
    danger.appendChild(info);
    const resetBtn = button(confirmingReset ? 'YES, RESET' : 'RESET', {
      variant: 'danger',
      onClick: () => {
        deps.audio.play('ui_click');
        if (!confirmingReset) {
          confirmingReset = true;
          render();
          return;
        }
        confirmingReset = false;
        handle.close();
        deps.onReset();
        toast('Save reset', 'info');
      },
    });
    resetBtn.classList.add('setting__toggle');
    danger.appendChild(resetBtn);
    body.appendChild(danger);

    const about = el('div', 'settings__about');
    versionNode = el('div', 'settings__version', `ZOMBUS · ${deps.version}`);
    about.appendChild(versionNode);
    about.appendChild(
      el('p', 'settings__legal', 'Your save lives in localStorage on this device. No login, no server.'),
    );
    body.appendChild(about);
  }

  render();
  return handle;
}