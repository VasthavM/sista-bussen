/**
 * Boot: save load, provider wiring, screen router, PWA plumbing and the debug API.
 * Gameplay never branches on `window.__game`; it exists for tests and console poking.
 */

import './style.css';

import { track } from './analytics';
import { createAudio } from './audio';
import { createRenderer } from './render';
import { dayKey } from './meta/daily';
import { grantIap } from './meta/economy';
import {
  createFreshProfile,
  ensureDailyContracts,
  parseSave,
  SAVE_KEY,
  saveProfile,
  type Profile,
} from './meta/save';
import { MockAdProvider, MockIapProvider } from './monetize/ads';
import { IAP_CATALOG, type IapSku } from './monetize/catalog';
import { Game } from './game';
import type { GameDebugApi } from './debug';
import { AdGate } from './ui/adOverlay';
import { openContracts } from './ui/contracts';
import { openCrate } from './ui/crate';
import { el, toast } from './ui/kit';
import { mountMenu, type MenuView, type RunSelection, type ShopTab } from './ui/menu';
import { OverlayHost } from './ui/overlay';
import { openSettings } from './ui/settings';
import { openShop } from './ui/shop';
import { UpdateCoordinator } from './updates';
import { versionLine } from './version';

const INTRO_KEY = 'sista-bussen.intro.v1';

function mustGet(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Sista Bussen: #${id} is missing from index.html`);
  return node;
}

const app = mustGet('app');
const stageFrame = mustGet('stage-frame');
const uiRoot = mustGet('ui');
const canvasNode = document.getElementById('stage');
if (!(canvasNode instanceof HTMLCanvasElement)) {
  throw new Error('Sista Bussen: #stage is missing from index.html');
}
const canvas: HTMLCanvasElement = canvasNode;

const toastStack = document.getElementById('toast-stack');
if (!toastStack) {
  const stack = el('div', 'toast-stack');
  stack.id = 'toast-stack';
  app.appendChild(stack);
}

// ---- save ----

let profile: Profile;
let recovered = false;
try {
  const text = localStorage.getItem(SAVE_KEY);
  const parsed = parseSave(text);
  profile = parsed.profile;
  recovered = parsed.recovered;
} catch {
  profile = createFreshProfile();
  recovered = true;
}

function persist(): void {
  saveProfile(profile);
}

function ensureContracts(): void {
  ensureDailyContracts(profile, dayKey(new Date()), Math.max(1, profile.nightUnlocked));
  persist();
}

ensureContracts();

if (recovered) {
  toast('Sparfilen kunde inte läsas — ny profil skapad', 'bad');
}

// ---- services ----

const audio = createAudio();
audio.setMuted(profile.settings.muted);

// ---- controlled updates (SW waiting / version line) ----

const updates = new UpdateCoordinator(app, () => game.getState().phase === 'menu');
updates.attach();

const renderer = createRenderer(canvas);

const overlay = new OverlayHost(uiRoot);
const gate = new AdGate(overlay);
const adProvider = new MockAdProvider(gate);
gate.attach(adProvider);

const iap = new MockIapProvider((product) => {
  grantIap(profile, product);
  persist();
  track('purchase', {
    sku: product.sku,
    priceSek: product.priceSek,
    tickets: product.tickets,
    removeAds: product.removesAds,
  });
  menu?.refresh();
});

let menu: MenuView | null = null;

function refreshMenu(): void {
  menu?.refresh();
}

function showMenu(announceBreak = true): void {
  game.toMenu();
  if (menu) {
    menu.refresh();
  } else {
    menu = mountMenu({
      root: uiRoot,
      profile,
      audio,
      showIntro: () => shouldShowIntro(),
      onStart: (selection) => beginRun(selection),
      onOpenShop: (tab) => openShopSheet(tab),
      onOpenContracts: () => openContractsSheet(),
      onOpenCrate: () => openCrateSheet(),
      onOpenSettings: () => openSettingsSheet(),
      onDismissIntro: () => {
        try {
          localStorage.setItem(INTRO_KEY, '1');
        } catch {
          /* fine without storage */
        }
      },
    });
  }
  // Menu entries are natural breaks: a waiting update may apply now (never at the
  // initial boot call, which passes `false`).
  if (announceBreak) updates.onMenu();
}

function shouldShowIntro(): boolean {
  if (profile.totalRuns > 0) return false;
  try {
    return localStorage.getItem(INTRO_KEY) !== '1';
  } catch {
    return true;
  }
}

function beginRun(selection: RunSelection): void {
  if (menu) {
    menu.destroy();
    menu = null;
  }
  game.setSelection(selection);
  game.startRun(selection);
}

function openShopSheet(tab: ShopTab): void {
  openShop({
    host: overlay,
    profile,
    audio,
    iap,
    persist,
    initialTab: tab,
    onPurchase: async (sku: IapSku) => {
      const result = await iap.purchase(sku);
      persist();
      refreshMenu();
      return { ok: result.ok, error: result.error };
    },
    onRestore: () => {
      for (const sku of profile.ownedSkus) {
        const product = IAP_CATALOG[sku as IapSku];
        if (!product) continue;
        if (product.removesAds) profile.removeAds = true;
      }
      persist();
      refreshMenu();
      toast(profile.ownedSkus.length > 0 ? 'Köp återställda' : 'Inga köp att återställa', 'info');
    },
    onChanged: refreshMenu,
  });
}

function openContractsSheet(): void {
  ensureContracts();
  openContracts({
    host: overlay,
    profile,
    audio,
    gate,
    persist,
    onChanged: refreshMenu,
    refreshContracts: () => {
      ensureContracts();
      return profile.contracts.items;
    },
  });
}

function openCrateSheet(): void {
  openCrate({ host: overlay, profile, audio, gate, persist, onChanged: refreshMenu });
}

function openSettingsSheet(): void {
  openSettings({
    host: overlay,
    profile,
    audio,
    version: updates.versionLine(),
    subscribeVersion: (listener) => updates.subscribe(listener),
    persist,
    onReset: resetSave,
    onChanged: refreshMenu,
  });
}

function resetSave(): void {
  game.toMenu();
  const fresh = createFreshProfile();
  Object.assign(profile, fresh);
  audio.setMuted(false);
  try {
    localStorage.removeItem(INTRO_KEY);
  } catch {
    /* fine */
  }
  ensureContracts();
  persist();
  if (menu) {
    menu.destroy();
    menu = null;
  }
  showMenu();
}

// ---- game ----

const game = new Game({
  canvas,
  renderer,
  uiRoot,
  overlay,
  profile,
  audio,
  gate,
  persist,
  onProfileChanged: refreshMenu,
  onExitToMenu: () => showMenu(),
  onRunSummary: () => updates.onSummary(),
});

// ---- resize / orientation ----

function resize(): void {
  const rect = stageFrame.getBoundingClientRect();
  const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  renderer.resize(Math.max(1, Math.floor(rect.width)), Math.max(1, Math.floor(rect.height)), dpr);
  renderer.invalidateGround();
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
resize();

// ---- audio unlock (first real gesture only) ----

function unlockAudio(): void {
  audio.unlock();
  window.removeEventListener('pointerdown', unlockAudio);
  window.removeEventListener('keydown', unlockAudio);
  window.removeEventListener('touchstart', unlockAudio);
}

window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);
window.addEventListener('touchstart', unlockAudio);

// ---- PWA ----

function ensureManifestLink(): void {
  const link = document.querySelector('link[rel="manifest"]');
  if (link) return;
  const created = document.createElement('link');
  created.rel = 'manifest';
  created.href = './manifest.webmanifest';
  document.head.appendChild(created);
  console.warn('Sista Bussen: manifest link was missing, injected at runtime');
}

ensureManifestLink();

/** Fade the inline boot screen out only once the menu can actually render. */
function closeBootScreen(): void {
  const boot = document.getElementById('boot');
  if (!boot) return;
  boot.classList.add('boot--out');
  window.setTimeout(() => boot.remove(), 240);
}

if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  window.addEventListener('load', () => {
    void updates.start();
  });
}

// ---- debug API (read-only with respect to gameplay) ----

const debugApi: GameDebugApi = {
  getState: () => game.getState(),
  grantXp: (n) => game.grantXp(n),
  forceSpawn: (type) => game.forceSpawn(type),
  endRun: () => game.endRun(),
  setHp: (n) => game.setHp(n),
  onScreenEnemies: () => game.onScreenEnemies(),
  closestEnemy: () => game.closestEnemy(),
  startRun: (opts = {}) => {
    const selection: RunSelection = {
      night: opts.night ?? Math.max(1, profile.nightUnlocked),
      character: opts.character ?? 'nattvandraren',
      weapon: opts.weapon ?? 'nyckel',
    };
    beginRun(selection);
  },
  setPhase: (phase) => game.setPhase(phase),
  grantTickets: (n) => {
    profile.tickets = Math.max(0, profile.tickets + Math.floor(n));
    persist();
    refreshMenu();
  },
  profile: () => ({
    tickets: profile.tickets,
    nightUnlocked: profile.nightUnlocked,
    bestNight: profile.bestNight,
    totalRuns: profile.totalRuns,
    weaponTokens: profile.weaponTokens,
    upgrades: { ...profile.upgrades },
  }),
  version: updates.versionLine(),
};

window.__game = debugApi;

// ---- start ----

// The first menu entry is the boot itself: no natural-break announcement here (a cold
// start must not immediately reload into itself — boot a waiting worker via its banner).
showMenu(false);
updates.settleBoot();
closeBootScreen();

if (profile.settings.muted) audio.setMuted(true);