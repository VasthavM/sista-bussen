/** Daily crate: streak, claim, and the ad-backed extra pulls. */

import { track } from '../analytics';
import type { AudioEngine } from '../audio';
import {
  claimDailyCrate,
  claimExtraCrate,
  crateAvailable,
  dayKey,
  extraPullsLeft,
} from '../meta/daily';
import type { Profile } from '../meta/save';
import { AD_PLACEMENTS } from '../monetize/catalog';
import { button, el, fmt, toast } from './kit';
import type { AdGate } from './adOverlay';
import type { OverlayHandle, OverlayHost } from './overlay';

export interface CrateDeps {
  host: OverlayHost;
  profile: Profile;
  audio: AudioEngine;
  gate: AdGate;
  persist(): void;
  onChanged(): void;
}

export function openCrate(deps: CrateDeps): OverlayHandle {
  const root = el('div', 'crate sheet');
  const handle: OverlayHandle = deps.host.push(root, { dismissable: true, label: 'Daglåda' });

  const head = el('div', 'sheet__head');
  head.appendChild(el('h2', 'sheet__title', 'DAGLÅDAN'));
  head.appendChild(el('p', 'sheet__sub', 'En per dag. Dag 7 ger en vapennyckel.'));
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
    const available = crateAvailable(deps.profile);
    const streak = deps.profile.daily.streak;
    const pulls = extraPullsLeft(deps.profile);

    const streakBox = el('div', 'crate__streak');
    for (let day = 1; day <= 7; day++) {
      const cell = el('div', `crate__day${day <= streak ? ' is-done' : ''}${day === 7 ? ' is-gift' : ''}`);
      cell.appendChild(el('span', 'crate__day-num', String(day)));
      cell.appendChild(el('span', 'crate__day-mark', day === 7 ? '★' : day <= streak ? '✓' : '·'));
      streakBox.appendChild(cell);
    }
    body.appendChild(streakBox);
    body.appendChild(
      el(
        'p',
        'crate__note',
        streak > 0 ? `Streak: ${streak} dag(ar). Nästa dag: dag ${(streak % 7) + 1}.` : 'Ingen streak än. Börja i natt.',
      ),
    );

    if (available) {
      const claim = button('ÖPPNA DAGLÅDAN', {
        variant: 'primary',
        sub: 'Gratis · en per dag',
        onClick: () => {
          const reward = claimDailyCrate(deps.profile);
          if (!reward.ok) {
            toast('Redan hämtad idag', 'bad');
            render();
            return;
          }
          track('crate_claim', {
            streak: reward.streak,
            tickets: reward.tickets,
            weaponTokens: reward.weaponTokens,
            viaAd: false,
          });
          deps.audio.play('ad_reward');
          deps.persist();
          deps.onChanged();
          toast(
            `+${fmt(reward.tickets)} Biljetter${reward.weaponTokens > 0 ? ' och 1 vapennyckel' : ''}`,
            'good',
          );
          render();
        },
      });
      claim.classList.add('crate__claim');
      body.appendChild(claim);
    } else {
      const done = button('DAGENS LÅDA ÄR TÖMD', { variant: 'ghost', disabled: true });
      done.classList.add('crate__claim');
      body.appendChild(done);
    }

    const adCap = AD_PLACEMENTS.free_crate.cap;
    const extra = button('EXTRA DRAG', {
      variant: 'amber',
      sub: `Belönad annons · ${pulls} av ${adCap} kvar idag`,
      disabled: pulls <= 0 || busy,
      onClick: () => {
        if (busy || pulls <= 0) return;
        busy = true;
        void deps.gate.run('free_crate').then((outcome) => {
          busy = false;
          if (!outcome.completed) {
            render();
            return;
          }
          const reward = claimExtraCrate(deps.profile);
          if (!reward.ok) {
            toast('Inga fler drag idag', 'bad');
            render();
            return;
          }
          track('crate_claim', {
            streak: deps.profile.daily.streak,
            tickets: reward.tickets,
            weaponTokens: 0,
            viaAd: true,
          });
          deps.audio.play('ad_reward');
          deps.persist();
          deps.onChanged();
          toast(`+${fmt(reward.tickets)} Biljetter`, 'good');
          render();
        });
      },
    });
    extra.classList.add('crate__extra');
    body.appendChild(extra);

    body.appendChild(
      el('p', 'crate__note crate__note--dim', `Dagens datum: ${dayKey(new Date())}. Streak bryts om du missar en dag.`),
    );
  }

  render();
  return handle;
}