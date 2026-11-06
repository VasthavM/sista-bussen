/**
 * Overlay stack. Every DOM overlay that owns input registers here, which is what
 * `ViewState.dimmed` and the run pause condition read. One place to push, one
 * place to close, no stray overlays left behind a restart.
 */

import { el } from './kit';

export interface OverlayHandle {
  el: HTMLElement;
  close(): void;
  readonly open: boolean;
}

interface Entry {
  wrap: HTMLElement;
  content: HTMLElement;
  onClose?: () => void;
  dismissable: boolean;
  open: boolean;
}

export class OverlayHost {
  private stack: Entry[] = [];
  private listeners: Array<() => void> = [];

  constructor(private root: HTMLElement) {}

  get open(): boolean {
    return this.stack.length > 0;
  }

  get depth(): number {
    return this.stack.length;
  }

  onChange(fn: () => void): () => void {
    this.listeners.push(fn);
    return () => {
      const at = this.listeners.indexOf(fn);
      if (at >= 0) this.listeners.splice(at, 1);
    };
  }

  private emit(): void {
    for (const fn of this.listeners) {
      try {
        fn();
      } catch {
        /* a listener must never break an overlay */
      }
    }
  }

  /**
   * Push an overlay. `dismissable` overlays can be closed with Esc / backdrop tap;
   * modal ones (ads, level-up cards) can only be closed by the game.
   */
  push(
    content: HTMLElement,
    opts: { onClose?: () => void; dismissable?: boolean; label?: string; bare?: boolean } = {},
  ): OverlayHandle {
    const wrap = el('div', opts.bare ? 'overlay overlay--bare' : 'overlay');
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    if (opts.label) wrap.setAttribute('aria-label', opts.label);

    const pane = el('div', 'overlay__pane');
    pane.appendChild(content);
    wrap.appendChild(pane);

    const entry: Entry = {
      wrap,
      content,
      onClose: opts.onClose,
      dismissable: opts.dismissable ?? false,
      open: true,
    };

    if (entry.dismissable) {
      wrap.addEventListener('pointerdown', (event) => {
        if (event.target === wrap) this.close(entry);
      });
    }

    this.root.appendChild(wrap);
    this.stack.push(entry);
    this.emit();

    return {
      el: content,
      get open() {
        return entry.open;
      },
      close: () => this.close(entry),
    };
  }

  private close(entry: Entry): void {
    if (!entry.open) return;
    entry.open = false;
    const at = this.stack.indexOf(entry);
    if (at >= 0) this.stack.splice(at, 1);
    if (entry.wrap.parentNode) entry.wrap.parentNode.removeChild(entry.wrap);
    this.emit();
    entry.onClose?.();
  }

  /** Esc / back: close the top dismissable overlay. Returns true when it did. */
  dismissTop(): boolean {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const entry = this.stack[i];
      if (entry.dismissable) {
        this.close(entry);
        return true;
      }
    }
    return false;
  }

  closeAll(): void {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      this.close(this.stack[i]);
    }
  }
}