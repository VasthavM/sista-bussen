/** The menu: title sign, route status, loadout, and the doors to the meta screens. */

import type { AudioEngine } from '../audio';
import { CHARACTERS, CHARACTER_ORDER, PASSIVES, WEAPONS, WEAPON_ORDER } from '../sim/content';
import { EVOLUTION_PASSIVE_LEVEL, WEAPON_MAX_LEVEL } from '../sim/upgrades';
import type { CharacterId, WeaponId } from '../sim/types';
import { isWeaponUnlocked, WEAPON_UNLOCK_COST } from '../meta/shop';
import type { Profile } from '../meta/save';
import { MATERIAL_ORDER, materialChip } from './icons';
import { button, el, fmt } from './kit';
import { buildRouteLine } from './route';
import { stopInSegment } from '../flow';
import { SEGMENT_LENGTH } from '../meta/route';
import { firstUnlockedWeapon, loadLoadout, saveLoadout } from './loadout';

export type ShopTab = 'upgrades' | 'weapons' | 'colours' | 'store';

export interface RunSelection {
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
  const selection: RunSelection = loadLoadout(storage(), weaponOpen);
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

    // ---- signage header ----
    const head = el('header', 'menu__head');
    const sign = el('div', 'menu__sign');
    sign.appendChild(el('div', 'menu__sign-top', 'SURVIVOR ROUTE'));
    sign.appendChild(el('h1', 'menu__title', 'ZOMBUS'));
    sign.appendChild(el('div', 'menu__sign-bottom', 'FIND FUEL. KEEP MOVING.'));
    sign.appendChild(el('p', 'menu__tagline', 'Everyone else is gone. The bus still runs.'));
    head.appendChild(sign);

    const wallet = el('div', 'menu__wallet');
    wallet.setAttribute('aria-label', 'Your materials');
    for (const id of MATERIAL_ORDER) {
      const chip = materialChip(id, fmt(deps.profile.materials[id]), 'wallet');
      wallet.appendChild(chip);
    }
    if (deps.profile.weaponTokens > 0) {
      const tokens = el('div', 'wallet wallet--token');
      tokens.appendChild(el('span', 'wallet__label', 'Weapon keys'));
      tokens.appendChild(el('span', 'wallet__value', fmt(deps.profile.weaponTokens)));
      wallet.appendChild(tokens);
    }
    head.appendChild(wallet);
    root.appendChild(head);

    // ---- body: where the route stands ----
    const body = el('div', 'menu__body');

    const route = deps.profile.route;
    const routeCard = el('section', 'menu__card menu__card--route');
    routeCard.dataset.menu = 'route';
    const routeHead = el('div', 'menu__card-head');
    routeHead.appendChild(el('h2', 'menu__card-title', 'Your route'));
    routeHead.appendChild(el('span', 'menu__card-stat', `Stop ${stopInSegment(route.depth)} / ${SEGMENT_LENGTH}`));
    routeCard.appendChild(routeHead);
    routeCard.appendChild(buildRouteLine(route, true));
    const best = el('p', 'menu__card-note');
    best.textContent =
      route.bestDepth > 0
        ? `Depth ${route.depth} · deepest map cleared: ${route.bestDepth}.`
        : 'No map cleared yet. The first one is always the worst.';
    routeCard.appendChild(best);
    body.appendChild(routeCard);

    root.appendChild(body);

    // ---- start + doors ----
    const foot = el('div', 'menu__foot');
    foot.appendChild(buildLoadoutRow());
    const startWrap = el('div', 'menu__start');
    const start = button('START', {
      variant: 'primary',
      onClick: () => {
        deps.audio.play('ui_click');
        deps.onStart({ ...selection });
      },
    });
    start.dataset.action = 'start';
    start.classList.add('menu__start-btn');
    startWrap.appendChild(start);
    foot.appendChild(startWrap);

    const nav = el('nav', 'menu__nav');
    nav.setAttribute('aria-label', 'Menu');
    const doors: Array<[string, string, () => void]> = [
      ['SHOP', ICONS.shop, () => deps.onOpenShop('upgrades')],
      ['CONTRACTS', ICONS.contracts, () => deps.onOpenContracts()],
      ['DAILY CRATE', ICONS.crate, () => deps.onOpenCrate()],
      ['SETTINGS', ICONS.settings, () => deps.onOpenSettings()],
    ];
    for (const [label, icon, open] of doors) {
      const item = el('button', 'menu__nav-item');
      item.type = 'button';
      item.appendChild(svgIcon(icon));
      item.appendChild(el('span', 'menu__nav-label', label));
      item.addEventListener('click', (event) => {
        event.preventDefault();
        deps.audio.play('ui_click');
        open();
      });
      nav.appendChild(item);
    }
    foot.appendChild(nav);
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
      slotButton('character', 'Survivor', who.name, who.title, who.colour, () => {
        sheet = 'character';
        focusAfter = '.pick.is-active';
        render();
      }),
    );
    row.appendChild(
      slotButton('weapon', 'Starting weapon', gun.name, gun.desc, gun.colour, () => {
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
    btn.setAttribute('aria-label', `${label} ${name}. Change.`);
    btn.style.setProperty('--slot', colour);
    btn.appendChild(el('span', 'loadout__label', label));
    const top = el('span', 'loadout__top');
    top.appendChild(el('span', 'loadout__name', name));
    const change = el('span', 'loadout__change');
    change.appendChild(svgIcon(ICONS.chevron));
    top.appendChild(change);
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
    const title = kind === 'character' ? 'Choose your survivor' : 'Choose your weapon';
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
            tag: `→ ${def.evolvedName}`,
            desc: def.desc,
            evo: `Evolves at level ${WEAPON_MAX_LEVEL} + ${PASSIVES[def.passive].name} ${EVOLUTION_PASSIVE_LEVEL}`,
            lockNote: `LOCKED · ${fmt(WEAPON_UNLOCK_COST)} Tickets · open the shop ›`,
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
    const done = button('CLOSE', { variant: 'ghost', onClick: closeSheet });
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
    evo?: string;
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
    if (o.evo) text.appendChild(el('span', 'pick__evo', o.evo));
    if (o.locked && o.lockNote) text.appendChild(el('span', 'pick__lock', o.lockNote));
    pick.appendChild(text);
    if (o.active) pick.appendChild(el('span', 'pick__check', 'PICKED'));
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

const ICONS = {
  shop: 'M6 8h12l-1 12H7L6 8z M9 8a3 3 0 0 1 6 0',
  contracts: 'M7 4h10v17H7z M10 9h4 M10 13h4 M10 17h2',
  crate: 'M3 8l9-4 9 4v9l-9 4-9-4z M3 8l9 4 9-4 M12 12v9',
  chevron: 'M6 9l6 6 6-6',
  settings: 'M4 7h9 M17 7h3 M4 17h3 M11 17h9 M15 4v6 M9 14v6',
} as const;

function svgIcon(path: string): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const shape = document.createElementNS(ns, 'path');
  shape.setAttribute('d', path);
  svg.appendChild(shape);
  return svg;
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
  panel.appendChild(el('div', 'intro__tag', 'FIRST ROUTE'));
  panel.appendChild(el('h2', 'intro__title', 'HOW TO SURVIVE'));
  const list = el('ol', 'intro__list');
  const items = [
    ['Fill the fuel gauge', 'Kill zombies and grab fuel canisters until you hit the quota.'],
    ['Then get to the bus', 'Reach it and you are out. The horde keeps growing while you wait.'],
    ['Drag to move', 'A floating stick appears under your thumb. Your weapon fires on its own.'],
    ['Pick your next stop', 'Every stop pays differently. Die, and you fall back to the last checkpoint.'],
    ['Ads are optional', 'Only when you want a second chance or double materials. Everything else is free.'],
  ];
  for (const [title, text] of items) {
    const li = el('li', 'intro__item');
    li.appendChild(el('strong', 'intro__item-title', title));
    li.appendChild(el('span', 'intro__item-text', text));
    list.appendChild(li);
  }
  panel.appendChild(list);
  panel.appendChild(
    button('GOT IT', {
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
