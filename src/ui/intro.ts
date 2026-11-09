/**
 * The first-run intro card and the cold open.
 *
 * Cold open: four text frames over pure canvas-free art (inline SVG, no assets),
 * shown once on first launch, skippable at any time, replayable from Settings.
 * Frame copy comes straight from `specs/design/v2-last-bus.md`.
 *
 * Intro card: the four-line "how to survive" card that sits over the menu the
 * first time. Its ad line states the real rule from the ad gate (#9): no ad
 * offers at all during the first `REWARDED_ONBOARDING_FREE_MINUTES` minutes.
 */
import { REWARDED_ONBOARDING_FREE_MINUTES } from '../monetize/catalog';
import { button, el } from './kit';
import './coldopen.css';

export const COLD_OPEN_KEY = 'sista-bussen.coldopen.v1';
const FRAME_MS = 3600;

export interface ColdOpenFrame {
  /** Lines shown one under the other. Order is the order on screen. */
  lines: string[];
  art: 'city' | 'bus' | 'map' | 'road';
}

export const COLD_OPEN_FRAMES: readonly ColdOpenFrame[] = [
  { art: 'city', lines: ['A dead city.', 'One bus, lights still on.'] },
  { art: 'bus', lines: ['Everyone else is gone.', 'The bus still runs.'] },
  { art: 'map', lines: ['One road.', 'One word on the map.'] },
  { art: 'road', lines: ['Find fuel.', 'Keep moving.'] },
];

/* --- art: static SVG, no assets, no scripts --------------------------------- */

const SKYLINE =
  '<path d="M0 300 V210 h26 v-40 h30 v52 h20 v-90 h36 v70 h24 v-30 h30 v100 h28 v-60 h34 v-34 h30 v94 h26 v-48 h28 v70 H320 V300 Z" fill="#0c1218"/>' +
  '<path d="M0 300 V240 h40 v-26 h28 v34 h30 v-56 h30 v48 h34 v-20 h38 v60 h40 v-38 h30 v40 h50 V300 Z" fill="#11181f"/>' +
  '<g fill="#d7e04a" opacity="0.5"><rect x="62" y="186" width="5" height="6"/><rect x="144" y="162" width="5" height="6"/><rect x="236" y="190" width="5" height="6"/></g>';

const BUS =
  '<g><path d="M92 214 L230 206 L230 252 L92 252 Z" fill="#0b0e12"/>' +
  '<rect x="96" y="210" width="130" height="38" rx="9" fill="#c97b12"/>' +
  '<rect x="102" y="216" width="118" height="12" rx="3" fill="#27414b"/>' +
  '<rect x="206" y="216" width="14" height="12" rx="2" fill="#0b0e12"/>' +
  '<circle cx="124" cy="252" r="9" fill="#0b0e12"/><circle cx="198" cy="252" r="9" fill="#0b0e12"/>' +
  '<circle cx="232" cy="225" r="6" fill="#f4fbff"/>' +
  '<path d="M236 218 L318 190 L318 262 L236 232 Z" fill="#ffe9a8" opacity="0.22"/></g>';

const ROUTE =
  '<rect x="10" y="40" width="300" height="220" rx="6" fill="#d6c9a3"/>' +
  '<g fill="none" stroke="#8c7d58" stroke-width="1.2" opacity="0.7"><path d="M10 100 H310 M10 160 H310 M10 220 H310 M80 40 V260 M160 40 V260 M240 40 V260"/></g>' +
  '<path d="M26 236 C80 220 70 160 130 150 S210 120 230 84 S262 70 288 60" fill="none" stroke="#7a2a16" stroke-width="3" stroke-dasharray="7 6" stroke-linecap="round"/>' +
  '<circle cx="26" cy="236" r="6" fill="#7a2a16"/>' +
  '<path d="M276 52 l12 8 l-12 8" fill="none" stroke="#7a2a16" stroke-width="3" stroke-linecap="round"/>' +
  '<g fill="#3b3426" font-family="Georgia, serif" font-size="13" font-style="italic"><text x="20" y="58">the road</text></g>' +
  '<g class="coldopen__circle"><ellipse cx="176" cy="188" rx="98" ry="28" fill="none" stroke="#b3202c" stroke-width="4" stroke-linecap="round" transform="rotate(-4 176 188)"/>' +
  '<text x="176" y="196" text-anchor="middle" fill="#b3202c" font-family="Georgia, serif" font-size="21" font-weight="700" letter-spacing="1">SURVIVORS?</text></g>';

const ROAD =
  '<rect x="0" y="0" width="320" height="300" fill="#0b0e12"/>' +
  '<path d="M160 20 L100 300 H220 Z" fill="#161d25"/>' +
  '<g stroke="#f5a524" stroke-width="5" stroke-linecap="round"><path d="M160 40 v22"/><path d="M158 110 v34"/><path d="M155 214 v52"/></g>' +
  '<path d="M160 120 L40 300 H280 Z" fill="#ffe9a8" opacity="0.1"/>';

const ART: Record<ColdOpenFrame['art'], string> = {
  city: `${SKYLINE}<rect x="0" y="258" width="320" height="42" fill="#090c0f"/><g transform="translate(30 53) scale(0.8)">${BUS}</g>`,
  bus: `<rect width="320" height="300" fill="#0b0e12"/>${BUS}`,
  map: ROUTE,
  road: ROAD,
};

function artNode(kind: ColdOpenFrame['art']): HTMLElement {
  const wrap = el('div', `coldopen__art coldopen__art--${kind}`);
  // Static, hard-coded markup only: nothing from the user or the save ever reaches this string.
  wrap.innerHTML = `<svg viewBox="0 0 320 300" role="img" aria-hidden="true" preserveAspectRatio="xMidYMid meet">${ART[kind]}</svg>`;
  return wrap;
}

/* --- state ----------------------------------------------------------------- */

export function coldOpenSeen(): boolean {
  try {
    return localStorage.getItem(COLD_OPEN_KEY) === '1';
  } catch {
    return true; // No storage means no way to remember, so never nag.
  }
}

function markColdOpenSeen(): void {
  try {
    localStorage.setItem(COLD_OPEN_KEY, '1');
  } catch {
    /* fine without storage */
  }
}

let active: { close(): void } | null = null;

/**
 * Play the cold open. Tap or Enter/Space advances, the SKIP button or Escape
 * closes at any point. Resolves nothing; `onDone` fires once on finish or skip.
 */
export function playColdOpen(onDone?: () => void): void {
  if (typeof document === 'undefined' || active) return;
  const host = document.getElementById('stage-frame') ?? document.body;
  const root = el('div', 'coldopen');
  root.dataset.screen = 'coldopen';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Intro');

  const stage = el('div', 'coldopen__stage');
  const dots = el('div', 'coldopen__dots');
  const dotNodes = COLD_OPEN_FRAMES.map(() => el('span', 'coldopen__dot'));
  for (const d of dotNodes) dots.appendChild(d);

  let index = -1;
  let timer = 0;
  let finished = false;

  const finish = (): void => {
    if (finished) return;
    finished = true;
    window.clearTimeout(timer);
    window.removeEventListener('keydown', onKey, true);
    root.classList.add('is-out');
    markColdOpenSeen();
    active = null;
    window.setTimeout(() => root.remove(), 260);
    onDone?.();
  };

  const show = (next: number): void => {
    window.clearTimeout(timer);
    if (next >= COLD_OPEN_FRAMES.length) {
      finish();
      return;
    }
    index = next;
    const frame = COLD_OPEN_FRAMES[index];
    stage.replaceChildren();
    const slide = el('div', 'coldopen__frame');
    slide.dataset.frame = String(index + 1);
    slide.appendChild(artNode(frame.art));
    const text = el('div', 'coldopen__text');
    for (const line of frame.lines) text.appendChild(el('p', 'coldopen__line', line));
    slide.appendChild(text);
    stage.appendChild(slide);
    dotNodes.forEach((d, i) => d.classList.toggle('is-on', i <= index));
    timer = window.setTimeout(() => show(index + 1), FRAME_MS);
  };

  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      finish();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      show(index + 1);
    }
  };

  root.appendChild(stage);
  root.appendChild(dots);
  const skip = button('SKIP', { variant: 'ghost', onClick: () => finish() });
  skip.classList.add('coldopen__skip');
  skip.addEventListener('pointerdown', (event) => event.stopPropagation());
  root.appendChild(skip);
  root.appendChild(el('div', 'coldopen__hint', 'tap to continue'));
  root.addEventListener('click', () => show(index + 1));
  window.addEventListener('keydown', onKey, true);

  host.appendChild(root);
  active = { close: finish };
  show(0);
}

/** First launch only: play the cold open unless it has been seen. */
export function maybePlayColdOpen(): void {
  if (!coldOpenSeen()) playColdOpen();
}

/* --- first-run intro card ---------------------------------------------------- */

export const INTRO_ITEMS: readonly (readonly [string, string])[] = [
  ['Fill the tank', 'Kill zombies and grab fuel. Fill the gauge, then get back to the bus to leave.'],
  ['Drag to move', 'A floating stick appears under your thumb. You steer where you drag.'],
  ['You shoot on your own', 'Weapons fire automatically. You only have to stay alive.'],
  [
    'Ads stay optional',
    `No ad offers for your first ${REWARDED_ONBOARDING_FREE_MINUTES} minutes. After that a rewarded ad is only ever an offer, never a requirement.`,
  ],
];

export interface IntroCardDeps {
  onDismiss(): void;
  /** Click sound, if any. */
  onClick?(): void;
}

export function buildIntroCard(deps: IntroCardDeps): HTMLElement {
  const intro = el('div', 'intro');
  intro.dataset.screen = 'intro';
  const panel = el('div', 'intro__panel');
  panel.appendChild(el('div', 'intro__tag', 'FIRST MAP'));
  panel.appendChild(el('h2', 'intro__title', 'HOW TO SURVIVE'));
  const list = el('ol', 'intro__list');
  for (const [title, text] of INTRO_ITEMS) {
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
        deps.onClick?.();
        deps.onDismiss();
        intro.remove();
      },
    }),
  );
  intro.appendChild(panel);
  return intro;
}
