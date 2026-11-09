/**
 * End-of-map summary. The only place rewarded offers (revive, double materials) are made.
 * Extracted: what the map paid. Died: what was lost and where the route falls back to.
 * CONTINUE always returns to the route screen; the route and the bank are already settled.
 */

import type { AudioEngine } from '../audio';
import { elapsedLabel } from '../flow';
import { AD_PLACEMENTS } from '../monetize/catalog';
import type { Materials, StopType } from '../sim/map';
import { MATERIAL_LABEL, MATERIAL_ORDER, STOP_INFO, icon, materialChip } from './icons';
import { bar, button, el, fmt, stat } from './kit';
import type { OverlayHandle, OverlayHost } from './overlay';

export interface SummaryData {
  outcome: 'extracted' | 'died';
  stop: StopType;
  /** Depth of the map just played. */
  depth: number;
  /** Stop number within the segment: the map just played, and where the route goes next. */
  stopNumber: number;
  nextStopNumber: number;
  /** Depth the route continues at (next map on extraction, checkpoint + 1 on death). */
  nextDepth: number;
  time: number;
  kills: number;
  fuel: number;
  fuelQuota: number;
  /** Gained on extraction, lost on death. Already doubled when `doubled`. */
  materials: Materials;
  doubled: boolean;
  revivesLeft: number;
  revivesUsed: number;
  /** False during onboarding: no ad offer is rendered at all. */
  adsOfferable: boolean;
}

export interface SummaryDeps {
  host: OverlayHost;
  audio: AudioEngine;
  onRevive: () => void;
  onDoubleMaterials: () => void;
  onContinue: () => void;
}

export interface SummaryView {
  handle: OverlayHandle;
  update(data: SummaryData): void;
  busy(busy: boolean): void;
}

export function mountSummary(deps: SummaryDeps, initial: SummaryData): SummaryView {
  const root = el('div', 'summary');
  const handle: OverlayHandle = deps.host.push(root, { label: 'Map over' });
  const buttons: HTMLButtonElement[] = [];

  function render(data: SummaryData): void {
    buttons.length = 0;
    root.dataset.outcome = data.outcome;
    while (root.firstChild) root.removeChild(root.firstChild);
    const won = data.outcome === 'extracted';

    const banner = el('div', `summary__banner summary__banner--${won ? 'win' : 'loss'}`);
    const tag = el('div', 'summary__tag');
    tag.appendChild(icon(won ? 'bus' : 'horde', 'summary__tag-icon'));
    tag.appendChild(el('span', undefined, `${won ? 'All aboard' : 'Overrun'} · ${STOP_INFO[data.stop].name}`));
    banner.appendChild(tag);
    banner.appendChild(el('h2', 'summary__title', won ? 'Extracted' : `Back to stop ${data.nextStopNumber}`));
    banner.appendChild(
      el(
        'p',
        'summary__sub',
        won
          ? `Stop ${data.stopNumber} cleared. Next up: stop ${data.nextStopNumber} / 10.`
          : `Checkpoint at depth ${data.nextDepth}. Everything you banked is safe.`,
      ),
    );
    root.appendChild(banner);

    const stats = el('div', 'summary__stats');
    stats.appendChild(stat('Time', elapsedLabel(data.time)));
    stats.appendChild(stat('Kills', fmt(data.kills)));
    stats.appendChild(stat('Depth', String(data.depth)));
    root.appendChild(stats);

    const gauge = bar(
      won ? 'bar--done' : 'bar--fuel',
      Math.min(1, data.fuel / Math.max(1, data.fuelQuota)),
      `FUEL ${fmt(data.fuel)} / ${fmt(data.fuelQuota)}`,
    );
    gauge.classList.add('summary__progress');
    root.appendChild(gauge);

    const loot = el('div', `summary__loot summary__loot--${won ? 'gained' : 'lost'}`);
    loot.dataset.summary = 'materials';
    loot.appendChild(
      el('div', 'summary__loot-label', won ? (data.doubled ? 'Gained · doubled' : 'Gained') : 'Lost with the map'),
    );
    const row = el('div', 'summary__loot-row');
    for (const id of MATERIAL_ORDER) {
      const amount = data.materials[id];
      const cell = materialChip(id, `${amount > 0 ? (won ? '+' : '−') : ''}${fmt(amount)}`, 'lootmat');
      cell.appendChild(el('span', 'lootmat__name', MATERIAL_LABEL[id]));
      row.appendChild(cell);
    }
    loot.appendChild(row);
    root.appendChild(loot);

    const offers = el('div', 'summary__offers');

    if (data.adsOfferable && !won && data.revivesLeft > 0) {
      const remainText = `${data.revivesLeft} of ${AD_PLACEMENTS.revive.cap} left`;
      const revive = button(AD_PLACEMENTS.revive.title, {
        variant: 'primary',
        sub: `Rewarded ad · ${AD_PLACEMENTS.revive.reward} · ${remainText}`,
        onClick: () => {
          deps.audio.play('ui_click');
          deps.onRevive();
        },
      });
      revive.classList.add('summary__offer', 'summary__offer--hero');
      buttons.push(revive);
      offers.appendChild(revive);
    }

    if (data.adsOfferable && won) {
      if (data.doubled) {
        const done = button('MATERIALS DOUBLED', { variant: 'ghost', disabled: true });
        done.classList.add('summary__offer');
        offers.appendChild(done);
      } else {
        const dbl = button(AD_PLACEMENTS.double_fares.title, {
          variant: 'amber',
          sub: `Rewarded ad · ${AD_PLACEMENTS.double_fares.reward}`,
          onClick: () => {
            deps.audio.play('ui_click');
            deps.onDoubleMaterials();
          },
        });
        dbl.classList.add('summary__offer');
        buttons.push(dbl);
        offers.appendChild(dbl);
      }
    }

    if (offers.childElementCount > 0) root.appendChild(offers);

    const next = button('Continue', {
      variant: 'primary',
      onClick: () => {
        deps.audio.play('ui_click');
        deps.onContinue();
      },
    });
    next.classList.add('summary__continue');
    next.dataset.action = 'continue';
    buttons.push(next);
    root.appendChild(next);

    if (data.revivesUsed > 0) {
      root.appendChild(el('p', 'summary__hint', `The bus was held up ${data.revivesUsed} time(s) on this map.`));
    }
  }

  render(initial);

  return {
    handle,
    update(next: SummaryData): void {
      render(next);
    },
    busy(busy: boolean): void {
      for (const btn of buttons) btn.disabled = busy;
    },
  };
}
