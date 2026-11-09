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
import { adsOfferable } from '../monetize/ads';
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
  const handle: OverlayHandle = deps.host.push(root, { dismissable: true, label: 'Daily crate' });

  const head = el('div', 'sheet__head');
  head.appendChild(el('h2', 'sheet__title', 'DAILY CRATE'));
  head.appendChild(el('p', 'sheet__sub', 'One a day. Day 7 drops a weapon key.'));
  root.appendChild(head);

  const body = el('div', 'sheet__body');
  root.appendChild(body);

  const foot = el('div', 'sheet__footer');
  foot.appendChild(
    button('CLOSE', {
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
        streak > 0 ? `Streak: ${streak} day${streak === 1 ? '' : 's'}. Next up: day ${(streak % 7) + 1}.` : 'No streak yet. Start tonight.',
      ),
    );

    if (available) {
      const claim = button('OPEN THE CRATE', {
        variant: 'primary',
        sub: 'Free · one a day',
        onClick: () => {
          const reward = claimDailyCrate(deps.profile);
          if (!reward.ok) {
            toast('Already claimed today', 'bad');
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
            `+${fmt(reward.tickets)} scrap${reward.weaponTokens > 0 ? ' and 1 weapon key' : ''}`,
            'good',
          );
          render();
        },
      });
      claim.classList.add('crate__claim');
      body.appendChild(claim);
    } else {
      const done = button('CRATE EMPTY TODAY', { variant: 'ghost', disabled: true });
      done.classList.add('crate__claim');
      body.appendChild(done);
    }

    if (adsOfferable(deps.profile)) {
      const adCap = AD_PLACEMENTS.free_crate.cap;
      const extra = button('EXTRA PULL', {
        variant: 'amber',
        sub: `Rewarded ad · ${pulls} of ${adCap} left today`,
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
              toast('No more pulls today', 'bad');
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
            toast(`+${fmt(reward.tickets)} scrap`, 'good');
            render();
          });
        },
      });
      extra.classList.add('crate__extra');
      body.appendChild(extra);
    }

    body.appendChild(
      el('p', 'crate__note crate__note--dim', `Today: ${dayKey(new Date())}. Miss a day and the streak resets.`),
    );
  }

  render();
  return handle;
}