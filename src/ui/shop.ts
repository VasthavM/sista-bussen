/** Shop: permanent power, weapon unlocks, colours and the IAP shelf. Every number comes from a frozen module. */

import type { AudioEngine } from '../audio';
import type { IapProvider } from '../monetize/ads';
import { formatSek, IAP_CATALOG, IAP_ORDER, type IapSku } from '../monetize/catalog';
import type { Profile } from '../meta/save';
import {
  buyColour,
  buyUpgrade,
  canBuyUpgrade,
  COLOURS,
  isWeaponUnlocked,
  modsFromProfile,
  SHOP_UPGRADES,
  UPGRADE_ORDER,
  upgradeCost,
  unlockWeaponWithTickets,
  upgradeLevel,
  WEAPON_UNLOCK_COST,
  type UpgradeId,
} from '../meta/shop';
import { WEAPONS, WEAPON_ORDER } from '../sim/content';
import { button, el, fmt, toast } from './kit';
import type { OverlayHandle, OverlayHost } from './overlay';
import type { ShopTab } from './menu';

export interface ShopDeps {
  host: OverlayHost;
  profile: Profile;
  audio: AudioEngine;
  iap: IapProvider;
  persist(): void;
  onPurchase(sku: IapSku): Promise<{ ok: boolean; error?: string }>;
  onRestore(): void;
  onChanged(): void;
  initialTab?: ShopTab;
}

const TABS: Array<{ id: ShopTab; label: string }> = [
  { id: 'upgrades', label: 'UPPGRADERINGAR' },
  { id: 'weapons', label: 'VAPEN' },
  { id: 'colours', label: 'FÄRGER' },
  { id: 'store', label: 'BUTIK' },
];

export function openShop(deps: ShopDeps): OverlayHandle {
  let tab: ShopTab = deps.initialTab ?? 'upgrades';

  const walletText = (): string => {
    const m = deps.profile.materials;
    return `${fmt(m.scrap)} Scrap · ${fmt(m.parts)} Parts · ${fmt(m.supplies)} Supplies`;
  };
  const root = el('div', 'shop sheet');
  const head = el('div', 'shop__head');
  head.appendChild(el('h2', 'sheet__title', 'BUTIKEN'));
  const wallet = el('div', 'shop__wallet');
  const balance = el('span', 'shop__balance', walletText());
  wallet.appendChild(balance);
  if (deps.profile.weaponTokens > 0) {
    wallet.appendChild(el('span', 'shop__tokens', `${fmt(deps.profile.weaponTokens)} vapennycklar`));
  }
  head.appendChild(wallet);
  root.appendChild(head);

  const tabBar = el('div', 'tabs');
  root.appendChild(tabBar);

  const body = el('div', 'shop__body');
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

  const handle: OverlayHandle = deps.host.push(root, { dismissable: true, label: 'Butik' });

  function refreshWallet(): void {
    balance.textContent = walletText();
    deps.onChanged();
  }

  function renderTabs(): void {
    while (tabBar.firstChild) tabBar.removeChild(tabBar.firstChild);
    for (const entry of TABS) {
      const active = entry.id === tab;
      const btn = button(entry.label, {
        variant: active ? 'amber' : 'ghost',
        onClick: () => {
          tab = entry.id;
          deps.audio.play('ui_click');
          render();
        },
      });
      btn.classList.add('tabs__tab');
      if (active) btn.classList.add('is-active');
      tabBar.appendChild(btn);
    }
  }

  function upgradeRow(id: UpgradeId): HTMLElement {
    const def = SHOP_UPGRADES[id];
    const level = upgradeLevel(deps.profile, id);
    const maxed = level >= def.maxLevel;
    const cost = upgradeCost(id, level);
    const wrap = el('div', 'shoprow');
    const info = el('div', 'shoprow__info');
    info.appendChild(el('div', 'shoprow__title', `${def.name} · nivå ${level}/${def.maxLevel}`));
    info.appendChild(el('div', 'shoprow__now', level > 0 ? def.description(level) : 'Ingen effekt än'));
    if (!maxed) info.appendChild(el('div', 'shoprow__next', `Nästa: ${def.description(level + 1)}`));
    wrap.appendChild(info);

    const action = button(maxed ? 'MAX' : fmt(cost), {
      variant: maxed ? 'ghost' : 'primary',
      disabled: maxed,
      onClick: () => {
        if (buyUpgrade(deps.profile, id)) {
          deps.audio.play('ui_buy');
          deps.persist();
          refreshWallet();
          render();
        } else {
          toast('Inte tillräckligt med material', 'bad');
        }
      },
    });
    action.classList.add('shoprow__action');
    if (!maxed && !canBuyUpgrade(deps.profile, id)) action.classList.add('btn--short');
    wrap.appendChild(action);
    return wrap;
  }

  function renderUpgrades(): void {
    const mods = modsFromProfile(deps.profile);
    const note = el('p', 'shop__note');
    note.textContent = 'Permanent kraft. Gäller varje natt från och med nästa runda.';
    body.appendChild(note);
    const summary = el('div', 'shop__mods');
    summary.textContent = `Skada +${Math.round(mods.damage * 100)}% · HP +${mods.hp} · Fart +${Math.round(
      mods.speed * 100,
    )}% · Krit +${Math.round(mods.crit * 100)}% · Växel +${Math.round(mods.fares * 100)}%`;
    body.appendChild(summary);
    for (const id of UPGRADE_ORDER) body.appendChild(upgradeRow(id));
  }

  function renderWeapons(): void {
    body.appendChild(
      el('p', 'shop__note', 'Lås upp ett startvapen. Vapennycklar kommer från daglådor och paket.'),
    );
    for (const id of WEAPON_ORDER) {
      const def = WEAPONS[id];
      const owned = isWeaponUnlocked(deps.profile, id);
      const wrap = el('div', 'shoprow');
      const info = el('div', 'shoprow__info');
      info.appendChild(el('div', 'shoprow__title', `${def.name} → ${def.evolvedName}`));
      info.appendChild(el('div', 'shoprow__now', def.desc));
      info.appendChild(el('div', 'shoprow__next', def.evolvedDesc));
      wrap.appendChild(info);

      if (owned) {
        const mark = button('UPPLÅST', { variant: 'ghost', disabled: true });
        mark.classList.add('shoprow__action');
        wrap.appendChild(mark);
      } else {
        const buy = button(`LÅS UPP · ${fmt(WEAPON_UNLOCK_COST)}`, {
          variant: 'primary',
          onClick: () => {
            if (unlockWeaponWithTickets(deps.profile, id)) {
              deps.audio.play('ui_buy');
              deps.persist();
              refreshWallet();
              render();
            } else {
              toast('Inte tillräckligt med material', 'bad');
            }
          },
        });
        buy.classList.add('shoprow__action');
        wrap.appendChild(buy);

        if (deps.profile.weaponTokens > 0) {
          const token = button('ANVÄND NYCKEL', {
            variant: 'amber',
            onClick: () => {
              deps.profile.weaponTokens -= 1;
              deps.profile.unlockedWeapons.push(id);
              deps.audio.play('ui_buy');
              deps.persist();
              refreshWallet();
              render();
            },
          });
          token.classList.add('shoprow__action');
          wrap.appendChild(token);
        }
      }
      body.appendChild(wrap);
    }
  }

  function renderColours(): void {
    body.appendChild(el('p', 'shop__note', 'Kosmetik. Ingen tur, inga lådor — du ser vad du får.'));
    for (const colour of COLOURS) {
      const owned = deps.profile.colours.includes(colour.id);
      const active = deps.profile.activeColour === colour.id;
      const wrap = el('div', 'shoprow shoprow--colour');
      const swatch = el('span', 'shoprow__swatch');
      swatch.style.background = colour.tint;
      wrap.appendChild(swatch);
      const info = el('div', 'shoprow__info');
      info.appendChild(el('div', 'shoprow__title', colour.name));
      info.appendChild(el('div', 'shoprow__now', active ? 'Aktiv' : owned ? 'Ägd' : `${fmt(colour.cost)} Biljetter`));
      wrap.appendChild(info);

      if (active) {
        const mark = button('VALD', { variant: 'ghost', disabled: true });
        mark.classList.add('shoprow__action');
        wrap.appendChild(mark);
      } else if (owned) {
        const pick = button('VÄLJ', {
          variant: 'primary',
          onClick: () => {
            buyColour(deps.profile, colour.id);
            deps.audio.play('ui_click');
            deps.persist();
            render();
          },
        });
        pick.classList.add('shoprow__action');
        wrap.appendChild(pick);
      } else {
        const buy = button(fmt(colour.cost), {
          variant: 'primary',
          onClick: () => {
            if (buyColour(deps.profile, colour.id)) {
              deps.audio.play('ui_buy');
              deps.persist();
              refreshWallet();
              render();
            } else {
              toast('Inte tillräckligt med material', 'bad');
            }
          },
        });
        buy.classList.add('shoprow__action');
        wrap.appendChild(buy);
      }
      body.appendChild(wrap);
    }
  }

  function renderStore(): void {
    body.appendChild(
      el(
        'p',
        'shop__note',
        deps.profile.removeAds ? 'Mellanannonser: AV (köpt). Belönade annonser finns kvar.' : 'Mellanannonser: PÅ.',
      ),
    );
    for (const sku of IAP_ORDER) {
      const product = IAP_CATALOG[sku];
      const owned = deps.profile.ownedSkus.includes(sku);
      const wrap = el('div', 'shoprow');
      const info = el('div', 'shoprow__info');
      info.appendChild(el('div', 'shoprow__title', product.title));
      info.appendChild(el('div', 'shoprow__now', product.description));
      if (product.tickets > 0) info.appendChild(el('div', 'shoprow__next', `${fmt(product.tickets)} Biljetter`));
      wrap.appendChild(info);

      const buy = button(formatSek(product.priceSek), {
        variant: owned && product.removesAds ? 'ghost' : 'primary',
        disabled: owned && product.removesAds,
        onClick: () => {
          buy.disabled = true;
          void deps.onPurchase(sku).then((result) => {
            if (result.ok) {
              deps.audio.play('ad_reward');
              refreshWallet();
              render();
            } else {
              toast('Köpet gick inte igenom', 'bad');
              buy.disabled = false;
            }
          });
        },
      });
      buy.classList.add('shoprow__action');
      wrap.appendChild(buy);
      body.appendChild(wrap);
    }

    const restore = button('ÅTERSTÄLL KÖP', {
      variant: 'ghost',
      onClick: () => {
        deps.onRestore();
        deps.audio.play('ui_click');
        render();
      },
    });
    restore.classList.add('shop__restore');
    body.appendChild(restore);

    const vip = el('p', 'shop__note shop__note--dim');
    vip.textContent =
      deps.profile.vipUntil > Date.now()
        ? 'Nattkort aktivt: +25% växel och uppgraderad daglåda.'
        : 'Nattkort: 24 timmar, +25% växel och uppgraderad daglåda.';
    body.appendChild(vip);
  }

  function render(): void {
    renderTabs();
    while (body.firstChild) body.removeChild(body.firstChild);
    if (tab === 'upgrades') renderUpgrades();
    else if (tab === 'weapons') renderWeapons();
    else if (tab === 'colours') renderColours();
    else renderStore();
    refreshWallet();
  }

  render();
  return handle;
}