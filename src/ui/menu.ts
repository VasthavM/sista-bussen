/** Kuren: the menu. Bus-stop signage, night select, loadout, and the doors to the meta screens. */

import type { AudioEngine } from '../audio';
import { CHARACTERS, CHARACTER_ORDER, WEAPONS, WEAPON_ORDER } from '../sim/content';
import type { CharacterId, WeaponId } from '../sim/types';
import { isWeaponUnlocked, WEAPON_UNLOCK_COST } from '../meta/shop';
import type { Profile } from '../meta/save';
import { button, el, fmt } from './kit';
import { firstUnlockedWeapon, loadLoadout, saveLoadout } from './loadout';

export type ShopTab = 'upgrades' | 'weapons' | 'colours' | 'store';

export interface RunSelection {
  night: number;
  character: CharacterId;
  weapon: WeaponId;
}

export interface MenuDeps {
  root: HTMLElement;
  profile: Profile;
  audio: AudioEngine;
  showIntro: () => boolean;
  onStart: (selection: RunSelection) => void;
  onOpenShop: (tab: ShopTab) => void;
  onOpenContracts: () => void;
  onOpenCrate: () => void;
  onOpenSettings: () => void;
  onDismissIntro: () => void;
}

export interface MenuView {
  refresh(): void;
  destroy(): void;
  selection(): RunSelection;
}

export function mountMenu(deps: MenuDeps): MenuView {
  const root = el('div', 'menu screen');
  root.dataset.screen = 'menu';
  deps.root.appendChild(root);

  const weaponOpen = (id: WeaponId): boolean => isWeaponUnlocked(deps.profile, id);
  const selection: RunSelection = {
    night: Math.max(1, deps.profile.nightUnlocked),
    ...loadLoadout(storage(), weaponOpen),
  };
  /** Which loadout sheet is open, and which control gets focus after the next render. */
  let sheet: 'character' | 'weapon' | null = null;
  let focusAfter: string | null = null;

  function choose(): void {
    saveLoadout(storage(), { character: selection.character, weapon: selection.weapon });
  }

  function closeSheet(): void {
    if (!sheet) return;
    focusAfter = `[data-loadout="${sheet}"]`;
    sheet = null;
    render();
  }

  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && sheet) {
      event.preventDefault();
      closeSheet();
    }
  };
  document.addEventListener('keydown', onKey);

  function render(): void {
    while (root.firstChild) root.removeChild(root.firstChild);
    if (!weaponOpen(selection.weapon)) selection.weapon = firstUnlockedWeapon(weaponOpen);
    if (selection.night > deps.profile.nightUnlocked) selection.night = deps.profile.nightUnlocked;

    // ---- signage header ----
    const head = el('header', 'menu__head');
    const sign = el('div', 'menu__sign');
    sign.appendChild(el('div', 'menu__sign-top', 'HÅLLPLATS · NATT'));
    sign.appendChild(el('h1', 'menu__title', 'SISTA BUSSEN'));
    sign.appendChild(el('div', 'menu__sign-bottom', '23:00 — 03:00'));
    head.appendChild(sign);
    head.appendChild(
      el('p', 'menu__tagline', 'Håll ut till sista bussen. Den är alltid sen, men den kommer.'),
    );

    const wallet = el('div', 'menu__wallet');
    const tickets = el('div', 'wallet wallet--tickets');
    tickets.appendChild(el('span', 'wallet__label', 'Biljetter'));
    tickets.appendChild(el('span', 'wallet__value', fmt(deps.profile.tickets)));
    wallet.appendChild(tickets);
    if (deps.profile.weaponTokens > 0) {
      const tokens = el('div', 'wallet wallet--token');
      tokens.appendChild(el('span', 'wallet__label', 'Vapennycklar'));
      tokens.appendChild(el('span', 'wallet__value', fmt(deps.profile.weaponTokens)));
      wallet.appendChild(tokens);
    }
    head.appendChild(wallet);
    root.appendChild(head);

    // ---- body ----
    const body = el('div', 'menu__body');

    const nightCard = el('section', 'menu__card');
    nightCard.appendChild(el('h2', 'menu__card-title', 'Natt'));
    const best = el('p', 'menu__card-note');
    best.textContent =
      deps.profile.bestNight > 0
        ? `Bästa natt: ${deps.profile.bestNight}. Upplåst till natt ${deps.profile.nightUnlocked}.`
        : 'Ingen natt klar än. Första natten är alltid värst.';
    nightCard.appendChild(best);

    const nightStrip = el('div', 'nights');
    const unlocked = Math.max(1, deps.profile.nightUnlocked);
    const startNight = Math.max(1, unlocked - 9);
    for (let n = startNight; n <= unlocked; n++) {
      const btn = button(String(n), {
        variant: n === selection.night ? 'amber' : 'ghost',
        ariaLabel: `Natt ${n}`,
        onClick: () => {
          selection.night = n;
          deps.audio.play('ui_click');
          render();
        },
      });
      btn.classList.add('nights__btn');
      if (n === deps.profile.bestNight) btn.classList.add('nights__btn--best');
      nightStrip.appendChild(btn);
    }
    const lockedNight = unlocked + 1;
    const locked = button(String(lockedNight), {
      variant: 'ghost',
      sub: 'låst',
      disabled: true,
      ariaLabel: `Natt ${lockedNight} låst`,
    });
    locked.classList.add('nights__btn', 'nights__btn--locked');
    nightStrip.appendChild(locked);
    nightCard.appendChild(nightStrip);

    if (deps.profile.bestNight > 0) {
      const bestNote = el('p', 'menu__card-note menu__card-note--dim');
      bestNote.textContent = `Natt ${deps.profile.bestNight} klaras av att överleva till 03:00.`;
      nightCard.appendChild(bestNote);
    }
    body.appendChild(nightCard);

    root.appendChild(body);

    // ---- start + doors ----
    const foot = el('div', 'menu__foot');
    foot.appendChild(buildLoadoutRow());
    const startWrap = el('div', 'menu__start');
    const start = button('ÅK UT I NATTEN', {
      variant: 'primary',
      sub: `Natt ${selection.night}`,
      onClick: () => {
        deps.audio.play('ui_click');
        deps.onStart({ ...selection });
      },
    });
    start.dataset.action = 'start';
    start.classList.add('menu__start-btn');
    startWrap.appendChild(start);
    foot.appendChild(startWrap);

    const doors = el('div', 'menu__doors');
    doors.appendChild(
      button('BUTIK', {
        variant: 'ghost',
        onClick: () => {
          deps.audio.play('ui_click');
          deps.onOpenShop('upgrades');
        },
      }),
    );
    doors.appendChild(
      button('KONTRAKT', {
        variant: 'ghost',
        onClick: () => {
          deps.audio.play('ui_click');
          deps.onOpenContracts();
        },
      }),
    );
    doors.appendChild(
      button('DAGLÅDA', {
        variant: 'ghost',
        onClick: () => {
          deps.audio.play('ui_click');
          deps.onOpenCrate();
        },
      }),
    );
    doors.appendChild(
      button('INSTÄLLNINGAR', {
        variant: 'ghost',
        onClick: () => {
          deps.audio.play('ui_click');
          deps.onOpenSettings();
        },
      }),
    );
    for (const child of Array.from(doors.children)) {
      (child as HTMLElement).classList.add('menu__door');
    }
    foot.appendChild(doors);
    root.appendChild(foot);

    if (sheet) root.appendChild(buildSheet(sheet));
    if (deps.showIntro()) root.appendChild(buildIntro(deps));

    if (focusAfter) {
      root.querySelector<HTMLElement>(focusAfter)?.focus({ preventScroll: true });
      focusAfter = null;
    }
  }

  /** Two big taps directly above the start button: who you are, what is in your pocket. */
  function buildLoadoutRow(): HTMLElement {
    const row = el('div', 'loadout');
    const who = CHARACTERS[selection.character];
    const gun = WEAPONS[selection.weapon];
    row.appendChild(
      slotButton('character', 'Vem är du i natt?', who.name, who.title, who.colour, () => {
        sheet = 'character';
        focusAfter = '.pick.is-active';
        render();
      }),
    );
    row.appendChild(
      slotButton('weapon', 'Vad har du i fickan?', gun.name, gun.desc, gun.colour, () => {
        sheet = 'weapon';
        focusAfter = '.pick.is-active';
        render();
      }),
    );
    return row;
  }

  function slotButton(
    slot: 'character' | 'weapon',
    label: string,
    name: string,
    line: string,
    colour: string,
    onClick: () => void,
  ): HTMLButtonElement {
    const btn = el('button', 'loadout__slot');
    btn.type = 'button';
    btn.dataset.loadout = slot;
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-label', `${label} ${name}. Byt.`);
    btn.style.setProperty('--slot', colour);
    btn.appendChild(el('span', 'loadout__label', label));
    const top = el('span', 'loadout__top');
    top.appendChild(el('span', 'loadout__name', name));
    top.appendChild(el('span', 'loadout__change', 'BYT ›'));
    btn.appendChild(top);
    btn.appendChild(el('span', 'loadout__line', line));
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      deps.audio.play('ui_click');
      onClick();
    });
    return btn;
  }

  function buildSheet(kind: 'character' | 'weapon'): HTMLElement {
    const layer = el('div', 'loadout-sheet');
    layer.dataset.sheet = kind;
    layer.addEventListener('click', (event) => {
      if (event.target === layer) closeSheet();
    });
    const panel = el('div', 'loadout-sheet__panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    const title = kind === 'character' ? 'Vem är du i natt?' : 'Vad har du i fickan?';
    panel.setAttribute('aria-label', title);
    panel.appendChild(el('h2', 'loadout-sheet__title', title));
    const list = el('div', 'picks');

    if (kind === 'character') {
      for (const id of CHARACTER_ORDER) {
        const def = CHARACTERS[id];
        list.appendChild(
          pickRow({
            key: { character: id },
            active: selection.character === id,
            colour: def.colour,
            name: def.name,
            tag: def.title,
            desc: def.desc,
            onPick: () => {
              selection.character = id;
              choose();
              closeSheet();
            },
          }),
        );
      }
    } else {
      for (const id of WEAPON_ORDER) {
        const def = WEAPONS[id];
        const open = weaponOpen(id);
        list.appendChild(
          pickRow({
            key: { weapon: id },
            active: selection.weapon === id,
            locked: !open,
            colour: def.colour,
            name: def.name,
            tag: def.evolvedName,
            desc: def.desc,
            lockNote: `LÅST · ${fmt(WEAPON_UNLOCK_COST)} Biljetter · till butiken ›`,
            onPick: () => {
              if (!open) {
                // Leave the sheet closed behind the shop so coming back lands on the menu.
                sheet = null;
                render();
                deps.onOpenShop('weapons');
                return;
              }
              selection.weapon = id;
              choose();
              closeSheet();
            },
          }),
        );
      }
    }
    panel.appendChild(list);
    const done = button('STÄNG', { variant: 'ghost', onClick: closeSheet });
    done.classList.add('loadout-sheet__close');
    panel.appendChild(done);
    layer.appendChild(panel);
    return layer;
  }

  interface PickOptions {
    key: { character: CharacterId } | { weapon: WeaponId };
    active: boolean;
    locked?: boolean;
    colour: string;
    name: string;
    tag: string;
    desc: string;
    lockNote?: string;
    onPick: () => void;
  }

  function pickRow(o: PickOptions): HTMLButtonElement {
    const pick = el('button', `pick${o.active ? ' is-active' : ''}${o.locked ? ' is-locked' : ''}`);
    pick.type = 'button';
    if ('character' in o.key) pick.dataset.character = o.key.character;
    else pick.dataset.weapon = o.key.weapon;
    pick.setAttribute('aria-pressed', String(o.active));
    pick.style.setProperty('--slot', o.colour);
    pick.appendChild(el('span', 'pick__swatch'));
    const text = el('span', 'pick__text');
    const head = el('span', 'pick__head');
    head.appendChild(el('span', 'pick__name', o.name));
    head.appendChild(el('span', 'pick__tag', o.tag));
    text.appendChild(head);
    text.appendChild(el('span', 'pick__desc', o.desc));
    if (o.locked && o.lockNote) text.appendChild(el('span', 'pick__lock', o.lockNote));
    pick.appendChild(text);
    if (o.active) pick.appendChild(el('span', 'pick__check', 'VALD'));
    pick.addEventListener('click', (event) => {
      event.preventDefault();
      deps.audio.play('ui_click');
      o.onPick();
    });
    return pick;
  }

  render();

  return {
    refresh(): void {
      render();
    },
    destroy(): void {
      document.removeEventListener('keydown', onKey);
      if (root.parentNode) root.parentNode.removeChild(root);
    },
    selection(): RunSelection {
      return { ...selection };
    },
  };
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function buildIntro(deps: MenuDeps): HTMLElement {
  const intro = el('div', 'intro');
  intro.dataset.screen = 'intro';
  const panel = el('div', 'intro__panel');
  panel.appendChild(el('div', 'intro__tag', 'FÖRSTA NATTEN'));
  panel.appendChild(el('h2', 'intro__title', 'SÅ HÄR ÖVERLEVER DU'));
  const list = el('ol', 'intro__list');
  const items = [
    ['Överlev till 03:00', 'Då kommer sista bussen. Det är hela målet.'],
    ['Dra med tummen', 'En flytande spak dyker upp där du sätter tummen. Du styr dit du drar.'],
    ['Du skjuter själv', 'Vapnet fyrdrar automatiskt. Du behöver bara inte dö.'],
    ['Annonser är frivilliga', 'Bara när du vill ha en till chans eller dubbla växlet. Allt annat är gratis.'],
  ];
  for (const [title, text] of items) {
    const li = el('li', 'intro__item');
    li.appendChild(el('strong', 'intro__item-title', title));
    li.appendChild(el('span', 'intro__item-text', text));
    list.appendChild(li);
  }
  panel.appendChild(list);
  panel.appendChild(
    button('UPPFATTAT', {
      variant: 'primary',
      onClick: () => {
        deps.audio.play('ui_click');
        deps.onDismissIntro();
        intro.remove();
      },
    }),
  );
  intro.appendChild(panel);
  return intro;
}