/** Stroke icons (24 box) shared by the route screen, HUD, summary and menu. Colour comes from `currentColor`. */

import type { MaterialId, StopType } from '../sim/map';
import { el } from './kit';

const PATHS = {
  scrap: 'M12 3l7.5 4.3v8.4L12 20l-7.5-4.3V7.3z M12 9.2a2.8 2.8 0 1 0 .01 0z',
  parts:
    'M7 12a5 5 0 1 0 10 0a5 5 0 1 0-10 0 M10.3 12a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0 M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5.6 5.6l2.1 2.1 M16.3 16.3l2.1 2.1 M18.4 5.6l-2.1 2.1 M7.7 16.3l-2.1 2.1',
  supplies: 'M5 7h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z M9 7V5h6v2 M12 10.5v5 M9.5 13h5',
  fuel: 'M6 20V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v15 M4 20h12 M8 8h4 M14 10h2.5a1.5 1.5 0 0 1 1.5 1.5V16a1.5 1.5 0 0 0 3 0V9l-2-2',
  street: 'M8.5 3L5 21 M15.5 3L19 21 M12 4.5v3 M12 11v3 M12 17.5v3',
  gas_station: 'M6 20V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v15 M4 20h12 M8 8h4 M14 10h2.5a1.5 1.5 0 0 1 1.5 1.5V16a1.5 1.5 0 0 0 3 0V9l-2-2',
  scrapyard: 'M3 20h18 M5 20l3.5-8 3 4 3.5-9 4 13',
  pharmacy: 'M12 3a9 9 0 1 0 .01 0z M12 7.5v9 M7.5 12h9',
  depot: 'M3 10l9-6 9 6 M5 9v11h14V9 M9 20v-6h6v6',
  horde:
    'M12 3a7 7 0 0 0-4 12.7V19h8v-3.7A7 7 0 0 0 12 3z M9.6 11.2a1.1 1.1 0 1 0 .01 0 M14.4 11.2a1.1 1.1 0 1 0 .01 0 M10 19v2 M14 19v2',
  safe: 'M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z M8.8 12.2l2.3 2.3 4.2-4.6',
  boss: 'M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z M5 19h14',
  flag: 'M6 21V4 M6 4h11l-2.5 4 2.5 4H6',
  bus: 'M5 17V6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5V17 M5 12h14 M4 17h16 M7 17v2.5 M17 17v2.5 M8.2 14.6h.01 M15.8 14.6h.01',
  clock: 'M12 4a8 8 0 1 0 .01 0z M12 8v4.2l2.8 1.8',
  back: 'M15 5l-7 7 7 7',
  kills: 'M12 3a7 7 0 0 0-4 12.7V19h8v-3.7A7 7 0 0 0 12 3z M9.6 11.2a1.1 1.1 0 1 0 .01 0 M14.4 11.2a1.1 1.1 0 1 0 .01 0',
} as const;

export type IconName = keyof typeof PATHS;

export function icon(name: IconName, className = 'icon'): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  const shape = document.createElementNS(ns, 'path');
  shape.setAttribute('d', PATHS[name]);
  svg.appendChild(shape);
  return svg;
}

export const MATERIAL_ORDER: readonly MaterialId[] = ['scrap', 'parts', 'supplies'];

export const MATERIAL_LABEL: Readonly<Record<MaterialId, string>> = {
  scrap: 'Scrap',
  parts: 'Parts',
  supplies: 'Supplies',
};

export interface StopInfo {
  readonly name: string;
  readonly blurb: string;
}

/** Player-facing copy per stop type. Numbers (quota, density) live in the route layer's STOP_TABLE. */
export const STOP_INFO: Readonly<Record<StopType, StopInfo>> = {
  street: { name: 'Street', blurb: 'Balanced haul. The safe bet.' },
  gas_station: { name: 'Gas Station', blurb: 'Fuel-rich, lower quota. More zombies.' },
  scrapyard: { name: 'Scrapyard', blurb: 'Double scrap in the wreckage.' },
  pharmacy: { name: 'Pharmacy', blurb: 'Shelves full of supplies.' },
  depot: { name: 'Depot', blurb: 'Crates of parts. Heavier resistance.' },
  horde: { name: 'Horde', blurb: 'Elite density. Double rewards.' },
  safe: { name: 'Safe Stop', blurb: 'No fight. Rest and trade.' },
  boss: { name: 'Boss Stop', blurb: 'Clear it to set a new checkpoint.' },
};

/** Icon + number (or label) pill for one material. */
export function materialChip(id: MaterialId, value: string, className = 'mat'): HTMLElement {
  const chip = el('span', `${className} ${className}--${id}`);
  chip.dataset.material = id;
  chip.setAttribute('role', 'img');
  chip.setAttribute('aria-label', `${MATERIAL_LABEL[id]} ${value}`);
  chip.appendChild(icon(id, `${className}__icon`));
  chip.appendChild(el('span', `${className}__value`, value));
  return chip;
}
