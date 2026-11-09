/**
 * Service worker coordinator: detects new versions in the background, reports the
 * controlling build (the version line's source of truth), and applies an update only
 * with the player's accepting tap or at a natural break (menu / run summary).
 *
 * Reload discipline: a reload happens exactly once per accepted update, driven by the
 * accepting page instance's own `controllerchange` with a fallback timer. The
 * `accepting`/`reloaded` flags live only on the accepting page instance, so a loop can
 * never form. Only the player's own tap on the banner may reload mid-run; an update
 * applied automatically at the menu reloads only while the menu is still showing.
 *
 * The run summary is a break where the update is *offered* again, never applied: the
 * payout is only written when the player leaves the summary, so a reload there would
 * forfeit the run's rewards and the revive offer.
 */

import { button, el, remove } from './ui/kit';
import { versionLine } from './version';

const RELOAD_FALLBACK_MS = 5_000;
/** Foreground update checks happen at most this often (iOS keeps installed PWAs alive for days). */
export const FOREGROUND_CHECK_INTERVAL_MS = 30 * 60 * 1000;

export class UpdateCoordinator {
  /** The build the controlling worker reports; null until it answers. */
  private controllerBuild: string | null = null;

  private waiting: ServiceWorker | null = null;
  private readonly announced = new Set<ServiceWorker>();
  private banner: HTMLElement | null = null;

  private booted = false;
  private accepting = false;
  private manual = false;
  private pendingReload = false;
  private reloaded = false;
  private fallbackTimer = 0;

  private registration: ServiceWorkerRegistration | null = null;
  private lastCheck = 0;

  private readonly listeners = new Set<(line: string) => void>();

  /**
   * `atMenu` tells whether the game is on the menu right now (reload is safe);
   * `inRun` whether a run is in active play (no update check then).
   */
  constructor(
    private readonly appRoot: HTMLElement,
    private readonly atMenu: () => boolean,
    private readonly inRun: () => boolean = () => false,
  ) {}

  /** Wire page-side SW listeners; call once at boot, before registration. */
  attach(): void {
    // Capacitor's iOS WebView has no serviceWorker API: no worker, no banner, version line only.
    if (!navigator.serviceWorker) return;
    navigator.serviceWorker.addEventListener('message', this.onMessage);
    navigator.serviceWorker.addEventListener('controllerchange', this.onControllerChange);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  async start(): Promise<void> {
    if (!navigator.serviceWorker) return;
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
      this.registration = registration;
      this.lastCheck = Date.now(); // registering just checked for a newer worker
      this.watch(registration);
      if (!navigator.serviceWorker.controller && registration.active) {
        // First visit: the page loaded before any worker could claim it. Only pages
        // with no controller ask for one, so there is never a mid-session takeover.
        registration.active.postMessage({ type: 'CLAIM' });
      }
      if (registration.waiting) this.announce(registration.waiting);
      this.askBuild();
    } catch {
      /* registration failures offline are fine: the app runs from regular HTTP */
    }
  }

  /** Called by main once the menu can render; ends reload-guard bookkeeping. */
  settleBoot(): void {
    this.booted = true;
  }

  versionLine(): string {
    return versionLine(this.controllerBuild ?? undefined);
  }

  subscribe(listener: (line: string) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Accept a restart. `manual` = the player tapped it; otherwise it is a menu break. */
  accept(manual = true): void {
    const waiting = this.waiting;
    if (!waiting || this.accepting || this.reloaded) return;
    this.accepting = true;
    this.manual = manual;
    this.closeBanner();
    waiting.postMessage({ type: 'SKIP_WAITING' });
    // If controllerchange never lands (the waiting worker was replaced meanwhile),
    // still do the single reload so the accepted version doesn't strand.
    this.fallbackTimer = window.setTimeout(() => this.reloadWhenSafe(), RELOAD_FALLBACK_MS);
  }

  /**
   * The menu is showing. If a worker became ready after boot, apply it quietly. Boot
   * announcements are banner-only: a cold start must not immediately reload into itself.
   */
  onMenu(): void {
    if (!this.booted) return;
    if (this.pendingReload) this.reloadOnce();
    else this.accept(false);
  }

  /** The run summary is showing: re-offer a waiting update, but never apply it here. */
  onSummary(): void {
    if (this.waiting && !this.accepting) this.showBanner();
  }

  private reloadWhenSafe(): void {
    if (this.manual || this.atMenu()) this.reloadOnce();
    else this.pendingReload = true; // the player already started a run: wait for the next menu
  }

  private reloadOnce(): void {
    if (this.reloaded) return;
    this.reloaded = true;
    window.clearTimeout(this.fallbackTimer);
    location.reload();
  }

  private onMessage = (event: MessageEvent): void => {
    const data = event.data as { type?: string; build?: unknown } | null;
    if (data && data.type === 'BUILD' && typeof data.build === 'string') {
      this.controllerBuild = data.build.trim() || null;
      this.emit();
    }
  };

  /**
   * Back in the foreground: look for a newer worker. A hit follows the normal rules
   * (banner, applied only at a break). Skipped during active play without using up the
   * throttle window, so the next foreground still checks.
   */
  private onVisibility = (): void => {
    if (document.visibilityState !== 'visible' || !this.registration || this.inRun()) return;
    const now = Date.now();
    if (now - this.lastCheck < FOREGROUND_CHECK_INTERVAL_MS) return;
    this.lastCheck = now;
    this.registration.update().catch(() => {
      /* offline or script fetch failed: try again at a later foreground */
    });
  };

  private onControllerChange = (): void => {
    // A new build now owns this page: ask for its build for the version line.
    this.askBuild();
    if (this.accepting) this.reloadWhenSafe();
  };

  private askBuild(): void {
    navigator.serviceWorker?.controller?.postMessage({ type: 'QUERY_BUILD' });
  }

  private watch(registration: ServiceWorkerRegistration): void {
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          // A controller exists: this new worker waits instead of taking over. On the
          // very first install there is no controller, so `activated` handles the claim.
          this.announce(worker);
        } else if (worker.state === 'activated') {
          if (!navigator.serviceWorker.controller) worker.postMessage({ type: 'CLAIM' });
          this.askBuild();
        }
      });
    });
  }

  private announce(worker: ServiceWorker): void {
    if (this.announced.has(worker)) return;
    this.announced.add(worker);
    this.waiting = worker;
    this.showBanner();
  }

  private showBanner(): void {
    if (this.banner) return;
    const banner = el('div', 'update-banner');
    banner.setAttribute('role', 'status');
    banner.appendChild(el('span', 'update-banner__text', 'New version ready'));
    const actions = el('div', 'update-banner__actions');
    actions.appendChild(
      button('UPDATE NOW', {
        variant: 'amber',
        onClick: () => this.accept(true),
        ariaLabel: 'Update to the new version',
      }),
    );
    actions.appendChild(button('LATER', { variant: 'ghost', onClick: () => this.closeBanner() }));
    banner.appendChild(actions);
    this.appRoot.appendChild(banner);
    requestAnimationFrame(() => banner.classList.add('update-banner--in'));
    this.banner = banner;
  }

  private closeBanner(): void {
    remove(this.banner);
    this.banner = null;
  }

  private emit(): void {
    const line = this.versionLine();
    for (const listener of this.listeners) listener(line);
  }
}
