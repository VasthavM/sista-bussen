/** Contracts: three rotating tasks, claim or skip with a rewarded ad (cap from the catalog). */

import { track } from '../analytics';
import type { AudioEngine } from '../audio';
import {
  claimContractReward,
  completeContractByAd,
  isContractComplete,
  type Contract,
} from '../meta/contracts';
import { dayKey, extraPullsLeft } from '../meta/daily';
import { addScrap, type Profile } from '../meta/save';
import { adsOfferable } from '../monetize/ads';
import { AD_PLACEMENTS } from '../monetize/catalog';
import { bar, button, el, fmt, toast } from './kit';
import type { AdGate } from './adOverlay';
import type { OverlayHandle, OverlayHost } from './overlay';

const SKIP_KEY = 'sista-bussen.contractskip.v1';

function skipKeyFor(day: string): string {
  return `${SKIP_KEY}.${day}`;
}

export function contractSkipUsed(day = dayKey(new Date())): boolean {
  try {
    return localStorage.getItem(skipKeyFor(day)) === '1';
  } catch {
    return false;
  }
}

function markSkipUsed(day = dayKey(new Date())): void {
  try {
    localStorage.setItem(skipKeyFor(day), '1');
  } catch {
    /* private mode: the cap is then per session, which is acceptable */
  }
}

export interface ContractsDeps {
  host: OverlayHost;
  profile: Profile;
  audio: AudioEngine;
  gate: AdGate;
  persist(): void;
  onChanged(): void;
  refreshContracts(): Contract[];
}

export function openContracts(deps: ContractsDeps): OverlayHandle {
  const root = el('div', 'contracts sheet');
  const handle: OverlayHandle = deps.host.push(root, { dismissable: true, label: 'Kontrakt' });

  const head = el('div', 'sheet__head');
  head.appendChild(el('h2', 'sheet__title', 'KONTRAKT'));
  head.appendChild(el('p', 'sheet__sub', 'Tre uppdrag per dag. De nollställs vid midnatt.'));
  root.appendChild(head);

  const body = el('div', 'sheet__body');
  root.appendChild(body);

  const foot = el('div', 'sheet__footer');
  foot.appendChild(
    button('STÄNG', {
      variant: 'ghost',
      onClick: () => {
        deps.audio.play('ui_click');
        handle.close();
      },
    }),
  );
  root.appendChild(foot);

  let busy = false;

  function render(): void {
    while (body.firstChild) body.removeChild(body.firstChild);
    const items = deps.refreshContracts();
    const day = dayKey(new Date());

    for (const contract of items) {
      body.appendChild(
        renderContract(contract, {
          onClaim: () => {
            if (busy) return;
            const result = claimContractReward(deps.profile.contracts.items, contract.id);
            if (result.reward <= 0) return;
            deps.profile.contracts.items = result.contracts;
            addScrap(deps.profile, result.reward);
            track('contract_claim', { id: contract.id, reward: result.reward, byAd: false });
            deps.audio.play('ui_buy');
            deps.persist();
            deps.onChanged();
            toast(`+${fmt(result.reward)} Biljetter`, 'good');
            render();
          },
          onSkip: () => {
            if (busy || contractSkipUsed(day)) return;
            busy = true;
            void deps.gate.run('contract_skip').then((outcome) => {
              busy = false;
              if (!outcome.completed) return;
              deps.profile.contracts.items = completeContractByAd(deps.profile.contracts.items, contract.id);
              markSkipUsed(day);
              track('contract_claim', { id: contract.id, reward: contract.reward, byAd: true });
              deps.audio.play('ad_reward');
              deps.persist();
              deps.onChanged();
              toast('Kontraktet är klart', 'good');
              render();
            });
          },
          skipOffered: adsOfferable(deps.profile),
          skipAvailable: !contractSkipUsed(day),
        }),
      );
    }

    if (adsOfferable(deps.profile)) {
      const pulls = el('div', 'contracts__pulls');
      pulls.textContent = `Daglådan: ${extraPullsLeft(deps.profile)} extra drag kvar idag.`;
      body.appendChild(pulls);
    }
  }

  render();
  return handle;
}

function renderContract(
  contract: Contract,
  handlers: { onClaim: () => void; onSkip: () => void; skipOffered: boolean; skipAvailable: boolean },
): HTMLElement {
  const complete = isContractComplete(contract);
  const wrap = el('div', `contract${contract.claimed ? ' contract--claimed' : ''}`);
  wrap.appendChild(el('div', 'contract__text', contract.text));

  const progress = bar(
    complete ? 'bar--done' : 'bar--contract',
    contract.target > 0 ? contract.progress / contract.target : 0,
  );
  progress.classList.add('contract__bar');
  wrap.appendChild(progress);
  wrap.appendChild(
    el(
      'div',
      'contract__meta',
      `${fmt(Math.min(contract.progress, contract.target))} / ${fmt(contract.target)} · ${fmt(contract.reward)} Biljetter`,
    ),
  );

  const actions = el('div', 'contract__actions');
  if (contract.claimed) {
    actions.appendChild(button('UTTAGEN', { variant: 'ghost', disabled: true }));
  } else if (complete) {
    actions.appendChild(button('HÄMTA BELÖNING', { variant: 'primary', onClick: handlers.onClaim }));
  } else if (handlers.skipOffered) {
    const skip = button('KLARA MED ANNONS', {
      variant: 'ghost',
      sub: handlers.skipAvailable
        ? `Belönad annons · ${AD_PLACEMENTS.contract_skip.cap} per dag`
        : 'Använd idag',
      disabled: !handlers.skipAvailable,
      onClick: handlers.onSkip,
    });
    actions.appendChild(skip);
  }
  wrap.appendChild(actions);
  return wrap;
}