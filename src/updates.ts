/**
 * Service worker coordinator: detects new versions in the background, reports the
 * controlling build (the version line's source of truth), and applies an update only
 * with the player's accepting tap or at a natural break (menu / run summary).
 *
 * Reload discipline: a reload happens exactly once per accepted update, driven by the
 * accepting page instance's own `controllerchange` with a fallback timer. The
 * `accepting`/`reloaded` flags live only on the accepting page instance, so a loop can
 * never form — and nothing reloads while a run is in progress unless the player tapped
 * the banner themselves.
 */

import { button, el, remove } from './ui/kit';
import { versionLine } from './version';

const RELOAD_FALLBACK_MS = 5_000;

export class UpdateCoordinator {
  /** The build the controlling worker reports; null until it answers. */
  private controllerBuild: string | null = null;

  private waiting: ServiceWorker | null = null;
  private readonly announced = new Set<ServiceWorker>();
  private banner: HTMLElement | null = null;

  private booted = false;
  private accepting = false;
  private reloaded = false;
  private fallbackTimer = 0;

  private readonly listeners = new Set<(line: string) => void>();

  constructor(private readonly appRoot: HTMLElement) {}

  /** Wire page-side SW listeners; call once at boot, before registration. */
  attach(): void {
    navigator.serviceWorker.addEventListener('message', this.onMessage);
    navigator.serviceWorker.addEventListener('controllerchange', this.onControllerChange);
  }

  async start(): Promise<void> {
    if (!('serviceWorker' in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
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

  /** Accept a restart: banner tap, or automatic application at a natural break. */
  accept(): void {
    const waiting = this.waiting;
    if (!waiting || this.accepting || this.reloaded) return;
    this.accepting = true;
    this.closeBanner();
    waiting.postMessage({ type: 'SKIP_WAITING' });
    // If controllerchange never lands (the waiting worker was replaced meanwhile),
    // force the single reload anyway so the accepted version doesn't strand.
    this.fallbackTimer = window.setTimeout(() => this.reloadOnce(), RELOAD_FALLBACK_MS);
  }

  /**
   * A natural break (menu or run summary) was reached mid-session. If a worker became
   * ready after boot, apply it quietly. Boot announcements are banner-only — a cold
   * start must not immediately reload into itself.
   */
  onNaturalBreak(): void {
    if (this.waiting && this.booted) this.accept();
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

  private onControllerChange = (): void => {
    // A new build now owns this page: ask for its build for the version line.
    this.askBuild();
    if (this.accepting) this.reloadOnce();
  };

  private askBuild(): void {
    navigator.serviceWorker.controller?.postMessage({ type: 'QUERY_BUILD' });
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
    banner.appendChild(el('span', 'update-banner__text', 'Ny version klar'));
    const actions = el('div', 'update-banner__actions');
    actions.appendChild(
      button('UPPDATERA NU', {
        variant: 'amber',
        onClick: () => this.accept(),
        ariaLabel: 'Uppdatera till den nya versionen',
      }),
    );
    actions.appendChild(button('SENARE', { variant: 'ghost', onClick: () => this.closeBanner() }));
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
