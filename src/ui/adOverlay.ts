/**
 * Honest ad presentation. The rewarded provider in `src/monetize/ads.ts` decides the
 * length and outcome; this overlay is the visible part: who paid, what you get, a
 * real countdown, and a cancel that forfeits the reward instead of trapping you.
 */

import { AD_COUNTDOWN_MS, AD_PLACEMENTS, type AdPlacement } from '../monetize/catalog';
import type { AdOutcome, AdPresenter, AdProvider } from '../monetize/ads';
import { track } from '../analytics';
import { button, el, remove } from './kit';
import type { OverlayHandle, OverlayHost } from './overlay';

export class AdGate implements AdPresenter {
  private provider: AdProvider | null = null;
  private handle: OverlayHandle | null = null;
  private root: HTMLElement | null = null;
  private fill: HTMLElement | null = null;
  private remain: HTMLElement | null = null;
  private status: HTMLElement | null = null;
  private cancel: HTMLButtonElement | null = null;
  private ticker: number | null = null;
  private endsAt = 0;
  private duration = AD_COUNTDOWN_MS;
  private active = false;
  private cancelledResolve: ((outcome: AdOutcome) => void) | null = null;
  private currentPlacement: AdPlacement = 'revive';
  private pending: Promise<AdOutcome> | null = null;

  constructor(private host: OverlayHost) {}

  attach(provider: AdProvider): void {
    this.provider = provider;
  }

  get isOpen(): boolean {
    return this.handle !== null;
  }

  /** Player-initiated rewarded ad. Resolves `completed:false` on cancel. */
  async run(placement: AdPlacement): Promise<AdOutcome> {
    if (!this.provider) return { completed: false, placement };
    if (this.active) return { completed: false, placement };
    if (this.pending) {
      try {
        await this.pending;
      } catch {
        /* ignore a failed previous show */
      }
    }
    this.active = true;
    this.currentPlacement = placement;
    track('ad_impression', { placement });

    const cancelled = new Promise<AdOutcome>((resolve) => {
      this.cancelledResolve = resolve;
    });
    const call = this.provider.showRewarded(placement);
    this.pending = call.finally(() => {
      this.pending = null;
    });

    const outcome = await Promise.race([call, cancelled]);
    this.cancelledResolve = null;
    this.active = false;
    if (outcome.completed) track('ad_reward', { placement });
    return outcome;
  }

  /** Non-rewarded break, only ever from the run summary and only when the guard allows. */
  async showInterstitial(): Promise<void> {
    if (this.active) return;
    this.active = true;
    await this.present(
      {
        tag: 'AD',
        title: 'THE ROAD CAN WAIT',
        reward: 'Skip ahead when the timer ends. Nothing to buy, nothing required.',
        placement: null,
      },
      AD_COUNTDOWN_MS,
      true,
    );
    this.active = false;
  }

  // ---- AdPresenter (called by the provider) ----

  show(placement: AdPlacement, durationMs: number): void {
    const def = AD_PLACEMENTS[placement];
    void this.present(
      {
        tag: 'REWARDED AD',
        title: def.title,
        reward: def.reward,
        placement,
      },
      durationMs,
    );
  }

  hide(): void {
    if (!this.root) return;
    this.stopTicker();
    if (this.fill) this.fill.style.width = '100%';
    if (this.remain) this.remain.textContent = '0.0';
    if (this.status) this.status.textContent = '✓ REWARD PAID OUT';
    if (this.cancel) {
      this.cancel.disabled = true;
      this.cancel.textContent = 'CLOSE';
    }
    const handle = this.handle;
    this.handle = null;
    window.setTimeout(() => {
      handle?.close();
    }, 260);
  }

  // ---- internals ----

  private present(
    content: { tag: string; title: string; reward: string; placement: AdPlacement | null },
    durationMs: number,
    autoClose = false,
  ): Promise<void> {
    this.removeOverlay();
    this.duration = Math.max(200, durationMs);
    this.endsAt = performance.now() + this.duration;

    const root = el('div', 'ad');
    const tag = el('div', 'ad__tag', content.tag);
    root.appendChild(tag);

    const board = el('div', 'ad__board');
    board.appendChild(el('div', 'ad__board-line', 'ZOMBUS'));
    board.appendChild(el('div', 'ad__board-line ad__board-line--dim', content.title));
    board.appendChild(el('div', 'ad__board-line ad__board-line--small', 'ROUTE 9 · NIGHT · RAIN'));
    root.appendChild(board);

    const reward = el('p', 'ad__reward', content.reward);
    root.appendChild(reward);

    const meter = el('div', 'ad__meter');
    const track = el('div', 'ad__meter-track');
    this.fill = el('div', 'ad__meter-fill');
    track.appendChild(this.fill);
    meter.appendChild(track);
    meter.appendChild(el('span', 'ad__meter-sep', '·'));
    this.remain = el('span', 'ad__meter-time', '0.0');
    meter.appendChild(this.remain);
    root.appendChild(meter);

    this.status = el('div', 'ad__status', 'Counting down. You can cancel, but then there is no reward.');
    root.appendChild(this.status);

    this.cancel = button('CANCEL · NO REWARD', {
      variant: 'ghost',
      onClick: () => {
        const placement = this.currentPlacement;
        const canceller = this.cancelledResolve;
        this.stopTicker();
        this.removeOverlay();
        if (canceller) canceller({ completed: false, placement });
      },
    });
    root.appendChild(this.cancel);

    this.root = root;
    this.handle = this.host.push(root, { bare: true, label: content.tag });
    this.tick(autoClose);

    return new Promise<void>((resolve) => {
      const check = (): void => {
        if (!this.handle) {
          window.clearInterval(this.ticker ?? 0);
          resolve();
          return;
        }
        if (performance.now() >= this.endsAt + 280) {
          resolve();
        } else {
          window.setTimeout(check, 120);
        }
      };
      check();
    });
  }

  private tick(autoClose: boolean): void {
    this.stopTicker();
    const duration = this.duration;
    let closing = false;
    this.ticker = window.setInterval(() => {
      const left = Math.max(0, this.endsAt - performance.now());
      const progress = 1 - left / duration;
      if (this.fill) this.fill.style.width = `${Math.min(100, progress * 100)}%`;
      if (this.remain) this.remain.textContent = (left / 1000).toFixed(1);
      if (left <= 0 && this.status) {
        this.status.textContent = autoClose ? 'Done.' : 'Done. Reward on its way.';
        if (this.cancel) {
          this.cancel.disabled = true;
          this.cancel.textContent = 'CLOSE';
        }
      }
      if (autoClose && left <= 0 && !closing) {
        closing = true;
        const handle = this.handle;
        this.handle = null;
        this.stopTicker();
        window.setTimeout(() => handle?.close(), 260);
      }
    }, 80);
  }

  private stopTicker(): void {
    if (this.ticker !== null) {
      window.clearInterval(this.ticker);
      this.ticker = null;
    }
  }

  private removeOverlay(): void {
    this.stopTicker();
    if (this.handle) {
      const handle = this.handle;
      this.handle = null;
      handle.close();
    }
    if (this.root) {
      remove(this.root);
      this.root = null;
    }
    this.fill = null;
    this.remain = null;
    this.status = null;
    this.cancel = null;
  }
}