/**
 * Level-up cards. Three cards, fan-in animation, rarity styling. Evolution cards
 * are visibly different: gold glow and the evolved name, because that is the build
 * goal the player is chasing.
 */

import type { AudioEngine } from '../audio';
import type { SimState, UpgradeChoice } from '../sim/types';
import { button, el } from './kit';
import type { OverlayHandle, OverlayHost } from './overlay';

export interface LevelUpDeps {
  host: OverlayHost;
  audio: AudioEngine;
  state: SimState;
  choices: UpgradeChoice[];
  adsOfferable: boolean;
  adRerollsLeft: number;
  adRerollCap: number;
  onPick: (id: string) => void;
  onReroll: () => void;
}

const RARITY_LABEL: Record<UpgradeChoice['rarity'], string> = {
  evolution: 'EVOLUTION',
  new: 'NEW WEAPON',
  weapon: 'WEAPON',
  passive: 'PASSIVE',
};

export function openLevelUp(deps: LevelUpDeps): OverlayHandle {
  const root = el('div', 'levelup');
  root.appendChild(el('div', 'levelup__tag', 'SCAVENGER PICK'));
  root.appendChild(el('h2', 'levelup__title', `LEVEL ${deps.state.level}`));
  root.appendChild(el('p', 'levelup__sub', 'Pick a card. The horde keeps coming.'));

  const fan = el('div', 'cards');

  deps.choices.forEach((choice, index) => {
    const card = el('button', `card card--${choice.rarity}`);
    card.type = 'button';
    card.style.setProperty('--i', String(index));
    card.setAttribute('aria-label', `${choice.name}: ${choice.desc}`);

    const badge = el('div', 'card__badge', RARITY_LABEL[choice.rarity]);
    card.appendChild(badge);

    card.appendChild(el('div', 'card__name', choice.name));

    const levelText =
      choice.rarity === 'evolution'
        ? 'MAX · EVOLVED'
        : choice.rarity === 'new'
          ? 'NEW'
          : `LEVEL ${choice.level}`;
    card.appendChild(el('div', 'card__level', levelText));
    card.appendChild(el('p', 'card__desc', choice.desc));

    if (choice.rarity === 'evolution') card.appendChild(el('div', 'card__glow'));

    card.addEventListener('click', (event) => {
      event.preventDefault();
      deps.audio.play('ui_click');
      deps.onPick(choice.id);
    });
    fan.appendChild(card);
  });

  root.appendChild(fan);

  if (!deps.adsOfferable) return deps.host.push(root, { label: 'Choose an upgrade' });

  const footer = el('div', 'levelup__footer');
  const reroll = button(deps.adRerollsLeft > 0 ? 'NEW CARDS' : 'NO REROLLS LEFT', {
    variant: 'ghost',
    sub:
      deps.adRerollsLeft > 0
        ? `Rewarded ad · ${deps.adRerollsLeft} of ${deps.adRerollCap} left`
        : `0 of ${deps.adRerollCap} left`,
    disabled: deps.adRerollsLeft <= 0,
    onClick: () => {
      reroll.disabled = true;
      deps.onReroll();
    },
  });
  reroll.classList.add('levelup__reroll');
  footer.appendChild(reroll);
  root.appendChild(footer);

  return deps.host.push(root, { label: 'Choose an upgrade' });
}