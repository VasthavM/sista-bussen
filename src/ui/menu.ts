/** Kuren: the menu. Bus-stop signage, night select, loadout, and the doors to the meta screens. */

import type { AudioEngine } from '../audio';
import { CHARACTERS, CHARACTER_ORDER, WEAPONS, WEAPON_ORDER } from '../sim/content';
import type { CharacterId, WeaponId } from '../sim/types';
import { isWeaponUnlocked, WEAPON_UNLOCK_COST } from '../meta/shop';
import type { Profile } from '../meta/save';
import { button, el, fmt } from './kit';

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

  const firstUnlocked = WEAPON_ORDER.find((id) => isWeaponUnlocked(deps.profile, id)) ?? 'nyckel';
  const selection: RunSelection = {
    night: Math.max(1, deps.profile.nightUnlocked),
    character: 'nattvandraren',
    weapon: firstUnlocked,
  };

  function render(): void {
    while (root.firstChild) root.removeChild(root.firstChild);
    if (!isWeaponUnlocked(deps.profile, selection.weapon)) {
      selection.weapon = WEAPON_ORDER.find((id) => isWeaponUnlocked(deps.profile, id)) ?? 'nyckel';
    }
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

    // ---- characters ----
    const charCard = el('section', 'menu__card');
    charCard.appendChild(el('h2', 'menu__card-title', 'Vem är du i natt?'));
    const chars = el('div', 'choices choices--char');
    for (const id of CHARACTER_ORDER) {
      const def = CHARACTERS[id];
      const pick = el('button', `choice choice--char${selection.character === id ? ' is-active' : ''}`);
      pick.type = 'button';
      pick.dataset.character = id;
      const dot = el('span', 'choice__dot');
      dot.style.background = def.colour;
      pick.appendChild(dot);
      pick.appendChild(el('span', 'choice__name', def.name));
      pick.appendChild(el('span', 'choice__title', def.title));
      pick.appendChild(el('span', 'choice__desc', def.desc));
      pick.addEventListener('click', (event) => {
        event.preventDefault();
        selection.character = id;
        deps.audio.play('ui_click');
        render();
      });
      chars.appendChild(pick);
    }
    charCard.appendChild(chars);
    body.appendChild(charCard);

    // ---- weapons ----
    const weaponCard = el('section', 'menu__card');
    weaponCard.appendChild(el('h2', 'menu__card-title', 'Vad har du i fickan?'));
    const weapons = el('div', 'choices choices--weapon');
    for (const id of WEAPON_ORDER) {
      const def = WEAPONS[id];
      const unlockedWeapon = isWeaponUnlocked(deps.profile, id);
      const pick = el(
        'button',
        `choice choice--weapon${selection.weapon === id ? ' is-active' : ''}${unlockedWeapon ? '' : ' is-locked'}`,
      );
      pick.type = 'button';
      pick.dataset.weapon = id;
      const swatch = el('span', 'choice__swatch');
      swatch.style.background = def.colour;
      pick.appendChild(swatch);
      pick.appendChild(el('span', 'choice__name', def.name));
      pick.appendChild(el('span', 'choice__title', def.evolvedName));
      pick.appendChild(
        el('span', 'choice__desc', unlockedWeapon ? def.desc : `Låst · ${fmt(WEAPON_UNLOCK_COST)} Biljetter`),
      );
      pick.addEventListener('click', (event) => {
        event.preventDefault();
        if (!unlockedWeapon) {
          deps.audio.play('ui_click');
          deps.onOpenShop('weapons');
          return;
        }
        selection.weapon = id;
        deps.audio.play('ui_click');
        render();
      });
      weapons.appendChild(pick);
    }
    weaponCard.appendChild(weapons);
    body.appendChild(weaponCard);
    root.appendChild(body);

    // ---- start + doors ----
    const foot = el('div', 'menu__foot');
    const startWrap = el('div', 'menu__start');
    const start = button('ÅK UT I NATTEN', {
      variant: 'primary',
      sub: `Natt ${selection.night} · ${CHARACTERS[selection.character].name} · ${WEAPONS[selection.weapon].name}`,
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

    if (deps.showIntro()) root.appendChild(buildIntro(deps));
  }

  render();

  return {
    refresh(): void {
      render();
    },
    destroy(): void {
      if (root.parentNode) root.parentNode.removeChild(root);
    },
    selection(): RunSelection {
      return { ...selection };
    },
  };
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