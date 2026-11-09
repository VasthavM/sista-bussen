/**
 * Route screen: where the run lives between maps. Shows the segment as a bus-line diagram,
 * the banked materials and 2-4 stop cards. One tap on a card plays that stop (or resolves it,
 * for a safe stop). The cards only render what `currentOptions` returns, so a later switch to
 * real branching paths changes the list and nothing here.
 */

import type { AudioEngine } from '../audio';
import { stopInSegment } from '../flow';
import {
  SAFE_GRANT,
  SEGMENT_LENGTH,
  currentOptions,
  type RouteState,
  type StopOption,
} from '../meta/route';
import type { Profile } from '../meta/save';
import type { Materials } from '../sim/map';
import { MATERIAL_LABEL, MATERIAL_ORDER, STOP_INFO, icon, materialChip } from './icons';
import { button, el, fmt } from './kit';

/** What a resolved safe stop paid, shown once on the screen that follows. */
export interface RouteFlash {
  title: string;
  grant: Materials;
}

export interface RouteDeps {
  root: HTMLElement;
  profile: Profile;
  audio: AudioEngine;
  /** Index into `currentOptions(route, routeSeed)`. */
  onPick: (index: number) => void;
  onBack: () => void;
}

export interface RouteView {
  refresh(flash?: RouteFlash): void;
  destroy(): void;
}

/** The segment as a bus line: ten stops, cleared ones filled, the boss as a crown at the end. */
export function buildRouteLine(route: RouteState, compact = false): HTMLElement {
  const stop = stopInSegment(route.depth);
  const wrap = el('div', `routeline${compact ? ' routeline--compact' : ''}`);
  wrap.style.setProperty('--frac', String((stop - 1) / (SEGMENT_LENGTH - 1)));
  const line = el('ol', 'routeline__track');
  line.setAttribute('aria-label', `Stop ${stop} of ${SEGMENT_LENGTH}`);
  for (let n = 1; n <= SEGMENT_LENGTH; n++) {
    const state = n < stop ? 'cleared' : n === stop ? 'current' : 'next';
    const node = el('li', `routeline__node is-${state}${n === SEGMENT_LENGTH ? ' is-boss' : ''}`);
    node.dataset.stop = String(n);
    if (n === SEGMENT_LENGTH) node.appendChild(icon('boss', 'routeline__icon'));
    line.appendChild(node);
  }
  wrap.appendChild(line);

  const legend = el('div', 'routeline__legend');
  const start = el('span', 'routeline__mark routeline__mark--start');
  start.appendChild(icon('flag', 'routeline__mark-icon'));
  start.appendChild(el('span', undefined, route.checkpoint === 0 ? 'Start' : `Checkpoint · depth ${route.checkpoint + 1}`));
  const end = el('span', 'routeline__mark routeline__mark--end');
  end.appendChild(el('span', undefined, `Boss · depth ${route.checkpoint + SEGMENT_LENGTH}`));
  end.appendChild(icon('boss', 'routeline__mark-icon'));
  legend.appendChild(start);
  legend.appendChild(end);
  wrap.appendChild(legend);
  return wrap;
}

function pips(danger: number): HTMLElement {
  const wrap = el('span', 'pips');
  wrap.setAttribute('role', 'img');
  wrap.setAttribute('aria-label', `Danger ${danger} of 3`);
  wrap.dataset.danger = String(danger);
  for (let i = 1; i <= 3; i++) wrap.appendChild(el('i', `pip${i <= danger ? ' is-on' : ''}`));
  return wrap;
}

function stopCard(option: StopOption, index: number, onPick: () => void): HTMLButtonElement {
  const info = STOP_INFO[option.type];
  const card = el('button', 'stop');
  card.type = 'button';
  card.dataset.stop = option.type;
  card.dataset.index = String(index);
  card.setAttribute('aria-label', `${info.name}. ${info.blurb} Danger ${option.danger} of 3.`);

  const tile = el('span', 'stop__tile');
  tile.appendChild(icon(option.type, 'stop__icon'));
  card.appendChild(tile);

  const text = el('span', 'stop__text');
  const head = el('span', 'stop__head');
  head.appendChild(el('span', 'stop__name', info.name));
  if (option.type === 'boss') head.appendChild(el('span', 'stop__tag', 'BOSS (coming soon)'));
  text.appendChild(head);
  text.appendChild(el('span', 'stop__blurb', info.blurb));

  const rewards = el('span', 'stop__rewards');
  if (option.type === 'safe') {
    for (const id of MATERIAL_ORDER) rewards.appendChild(materialChip(id, `+${SAFE_GRANT[id]}`, 'chip'));
  } else if (option.rewardHint === 'fuel') {
    const fuel = el('span', 'chip chip--fuel');
    fuel.appendChild(icon('fuel', 'chip__icon'));
    fuel.appendChild(el('span', 'chip__value', 'Fuel'));
    rewards.appendChild(fuel);
  } else {
    rewards.appendChild(materialChip(option.rewardHint, MATERIAL_LABEL[option.rewardHint], 'chip'));
  }
  text.appendChild(rewards);
  card.appendChild(text);

  const risk = el('span', 'stop__risk');
  risk.appendChild(el('span', 'stop__risk-label', option.type === 'safe' ? 'Calm' : 'Danger'));
  if (option.type !== 'safe') risk.appendChild(pips(option.danger));
  card.appendChild(risk);

  card.addEventListener('click', (event) => {
    event.preventDefault();
    onPick();
  });
  return card;
}

export function mountRoute(deps: RouteDeps): RouteView {
  const root = el('div', 'route screen');
  root.dataset.screen = 'route';
  deps.root.appendChild(root);
  let flashTimer = 0;

  function render(flash?: RouteFlash): void {
    const { profile } = deps;
    const route = profile.route;
    while (root.firstChild) root.removeChild(root.firstChild);

    const head = el('header', 'route__head');
    const eyebrow = el('div', 'route__eyebrow');
    eyebrow.appendChild(el('span', undefined, 'Route'));
    const depth = el('span', 'route__depth', `Depth ${route.depth}`);
    depth.dataset.route = 'depth';
    eyebrow.appendChild(depth);
    head.appendChild(eyebrow);

    const title = el('h1', 'route__title');
    title.dataset.route = 'stop';
    title.appendChild(el('span', 'route__title-label', 'Stop '));
    title.appendChild(el('span', 'route__title-n', String(stopInSegment(route.depth))));
    title.appendChild(el('span', 'route__title-of', ` / ${SEGMENT_LENGTH}`));
    head.appendChild(title);
    head.appendChild(buildRouteLine(route));
    root.appendChild(head);

    const mats = el('div', 'route__mats');
    mats.dataset.route = 'materials';
    mats.setAttribute('aria-label', 'Banked materials');
    for (const id of MATERIAL_ORDER) mats.appendChild(materialChip(id, fmt(profile.materials[id]), 'wallet'));
    root.appendChild(mats);

    if (flash) {
      const strip = el('div', 'route__flash');
      strip.dataset.route = 'flash';
      strip.appendChild(icon('safe', 'route__flash-icon'));
      strip.appendChild(el('span', 'route__flash-title', flash.title));
      const chips = el('span', 'route__flash-chips');
      for (const id of MATERIAL_ORDER) chips.appendChild(materialChip(id, `+${flash.grant[id]}`, 'chip'));
      strip.appendChild(chips);
      root.appendChild(strip);
      window.clearTimeout(flashTimer);
      flashTimer = window.setTimeout(() => strip.classList.add('is-out'), 4200);
    }

    const options = currentOptions(route, profile.routeSeed);
    const list = el('div', 'route__options');
    list.dataset.route = 'options';
    list.setAttribute('role', 'group');
    list.setAttribute('aria-label', 'Choose your next stop');
    options.forEach((option, index) => {
      list.appendChild(
        stopCard(option, index, () => {
          deps.audio.play('ui_click');
          deps.onPick(index);
        }),
      );
    });
    root.appendChild(list);

    const foot = el('footer', 'route__foot');
    const back = button('Menu', {
      variant: 'ghost',
      onClick: () => {
        deps.audio.play('ui_click');
        deps.onBack();
      },
    });
    back.classList.add('route__back');
    back.prepend(icon('back', 'route__back-icon'));
    foot.appendChild(back);
    foot.appendChild(el('p', 'route__rule', `Die and you fall back to stop 1.`));
    root.appendChild(foot);
  }

  render();

  return {
    refresh(flash?: RouteFlash): void {
      render(flash);
    },
    destroy(): void {
      window.clearTimeout(flashTimer);
      if (root.parentNode) root.parentNode.removeChild(root);
    },
  };
}
