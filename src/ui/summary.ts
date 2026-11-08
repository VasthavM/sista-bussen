/**
 * Run summary. This is the only place offers are made, the only place interstitials
 * can be triggered (game decides via `shouldShowInterstitial`), and the only place a
 * run is converted into Biljetter.
 */

import type { AudioEngine } from '../audio';
import { AD_PLACEMENTS } from '../monetize/catalog';
import { clockLabel, RUN_DURATION } from '../sim/curve';
import { bar, button, clockText, el, fmt, stat } from './kit';
import type { OverlayHandle, OverlayHost } from './overlay';

export interface SummaryData {
  won: boolean;
  night: number;
  survived: number;
  kills: number;
  level: number;
  change: number;
  tickets: number;
  nightBonus: number;
  doubleFares: boolean;
  revivesLeft: number;
  revivesUsed: number;
  nextNightUnlocked: boolean;
  /** False during onboarding: no ad offer is rendered at all. */
  adsOfferable: boolean;
}

export interface SummaryDeps {
  host: OverlayHost;
  audio: AudioEngine;
  onRevive: () => void;
  onDoubleFares: () => void;
  onRetry: () => void;
  onExit: () => void;
}

export interface SummaryView {
  handle: OverlayHandle;
  update(data: SummaryData): void;
  busy(busy: boolean): void;
}

export function mountSummary(deps: SummaryDeps, initial: SummaryData): SummaryView {
  const root = el('div', 'summary');
  const handle: OverlayHandle = deps.host.push(root, { label: 'Rundan slut' });
  const buttons: HTMLButtonElement[] = [];
  let current = initial;

  function render(data: SummaryData): void {
    current = data;
    buttons.length = 0;
    while (root.firstChild) root.removeChild(root.firstChild);

    const banner = el('div', `summary__banner summary__banner--${data.won ? 'win' : 'loss'}`);
    banner.appendChild(el('div', 'summary__tag', data.won ? 'BUSSEN KOM' : 'BUSSEN GICK UTAN DIG'));
    banner.appendChild(
      el('h2', 'summary__title', data.won ? '03:00' : `SISTA CHANSEN ${clockLabel(data.survived)}`),
    );
    banner.appendChild(
      el('p', 'summary__sub', data.won ? `Natt ${data.night} klar.` : `Du höll ut ${clockText(data.survived)} av natten.`),
    );
    root.appendChild(banner);

    const stats = el('div', 'summary__stats');
    stats.appendChild(stat('Natt', String(data.night)));
    stats.appendChild(stat('Klockan', clockLabel(data.survived)));
    stats.appendChild(stat('Nivå', String(data.level)));
    stats.appendChild(stat('Fiender', fmt(data.kills)));
    root.appendChild(stats);

    const progress = bar('bar--night', Math.min(1, data.survived / RUN_DURATION), clockLabel(data.survived));
    progress.classList.add('summary__progress');
    root.appendChild(progress);

    const payout = el('div', 'summary__payout');
    payout.appendChild(el('div', 'summary__payout-label', data.doubleFares ? 'VÄXEL · DUBBLAD' : 'VÄXEL'));
    payout.appendChild(el('div', 'summary__payout-value', `${fmt(data.change * (data.doubleFares ? 2 : 1))} kr`));
    payout.appendChild(el('div', 'summary__payout-note', `= ${fmt(data.tickets + data.nightBonus)} Biljetter`));
    if (data.nightBonus > 0) {
      payout.appendChild(el('div', 'summary__payout-note', `varav nattbonus ${fmt(data.nightBonus)}`));
    }
    root.appendChild(payout);

    const offers = el('div', 'summary__offers');

    if (data.adsOfferable && !data.won && data.revivesLeft > 0) {
      const remainText = `${data.revivesLeft} av ${AD_PLACEMENTS.revive.cap} kvar`;
      const revive = button(AD_PLACEMENTS.revive.title, {
        variant: 'primary',
        sub: `Belönad annons · ${AD_PLACEMENTS.revive.reward} · ${remainText}`,
        onClick: () => {
          deps.audio.play('ui_click');
          deps.onRevive();
        },
      });
      revive.classList.add('summary__offer', 'summary__offer--hero');
      buttons.push(revive);
      offers.appendChild(revive);
    }

    if (!data.adsOfferable) {
      // Onboarding: nothing to offer.
    } else if (!data.doubleFares) {
      const dbl = button(AD_PLACEMENTS.double_fares.title, {
        variant: 'amber',
        sub: `Belönad annons · ${AD_PLACEMENTS.double_fares.reward}`,
        onClick: () => {
          deps.audio.play('ui_click');
          deps.onDoubleFares();
        },
      });
      dbl.classList.add('summary__offer');
      buttons.push(dbl);
      offers.appendChild(dbl);
    } else {
      const done = button('VÄXLET ÄR DUBBLAT', { variant: 'ghost', disabled: true });
      done.classList.add('summary__offer');
      offers.appendChild(done);
    }

    if (offers.childElementCount > 0) root.appendChild(offers);

    const nav = el('div', 'summary__nav');
    const retry = button(data.won ? 'SPELA NÄSTA NATT' : 'FÖRSÖK IGEN', {
      variant: 'primary',
      onClick: () => {
        deps.audio.play('ui_click');
        deps.onRetry();
      },
    });
    buttons.push(retry);
    nav.appendChild(retry);

    const exit = button('TILL KUREN', {
      variant: 'ghost',
      onClick: () => {
        deps.audio.play('ui_click');
        deps.onExit();
      },
    });
    buttons.push(exit);
    nav.appendChild(exit);
    root.appendChild(nav);

    if (data.won && data.nextNightUnlocked) {
      root.appendChild(el('p', 'summary__hint', `Natt ${data.night + 1} är upplåst i Kuren.`));
    }
    if (data.revivesUsed > 0) {
      root.appendChild(el('p', 'summary__hint', `Bussen försenades ${data.revivesUsed} gång(er) i natt.`));
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