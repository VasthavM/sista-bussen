/** Small DOM kit shared by every overlay. No framework, no allocation in frame loops. */

export type Variant = 'primary' | 'ghost' | 'danger' | 'amber';

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function remove(node: HTMLElement | null | undefined): void {
  if (node && node.parentNode) node.parentNode.removeChild(node);
}

export interface ButtonOptions {
  variant?: Variant;
  sub?: string;
  disabled?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}

export function button(label: string, options: ButtonOptions = {}): HTMLButtonElement {
  const btn = el('button', `btn btn--${options.variant ?? 'ghost'}`);
  btn.type = 'button';
  const main = el('span', 'btn__label', label);
  btn.appendChild(main);
  if (options.sub) btn.appendChild(el('span', 'btn__sub', options.sub));
  if (options.ariaLabel) btn.setAttribute('aria-label', options.ariaLabel);
  if (options.disabled) {
    btn.disabled = true;
  } else if (options.onClick) {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      options.onClick?.();
    });
  }
  return btn;
}

/** Chunked, safely tappable list row with a price/level on the right. */
export function row(main: string, meta: string): HTMLElement {
  const item = el('div', 'row');
  const left = el('div', 'row__main');
  left.appendChild(el('div', 'row__title', main));
  item.appendChild(left);
  item.appendChild(el('div', 'row__meta', meta));
  return item;
}

export function bar(className: string, fraction: number, label?: string): HTMLElement {
  const wrap = el('div', `bar ${className}`);
  const fill = el('div', 'bar__fill');
  const clamped = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
  fill.style.width = `${clamped * 100}%`;
  wrap.appendChild(fill);
  if (label) wrap.appendChild(el('span', 'bar__label', label));
  return wrap;
}

export function stat(label: string, value: string): HTMLElement {
  const cell = el('div', 'stat');
  cell.appendChild(el('div', 'stat__label', label));
  cell.appendChild(el('div', 'stat__value', value));
  return cell;
}

export function heading(title: string, sub?: string): HTMLElement {
  const head = el('div', 'heading');
  head.appendChild(el('h2', 'heading__title', title));
  if (sub) head.appendChild(el('p', 'heading__sub', sub));
  return head;
}

export function fmt(n: number): string {
  const value = Math.max(0, Math.round(n));
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
}

export function clockText(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

let toastTimer: number | null = null;

/** Non-blocking feedback for purchases, claims and unlock attempts. */
export function toast(message: string, kind: 'info' | 'good' | 'bad' = 'info'): void {
  const host = document.getElementById('toast-stack');
  if (!host) return;
  const node = el('div', `toast toast--${kind}`, message);
  host.appendChild(node);
  while (host.childElementCount > 3 && host.firstElementChild) {
    host.removeChild(host.firstElementChild);
  }
  if (toastTimer !== null) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    node.classList.add('toast--out');
    window.setTimeout(() => remove(node), 260);
    toastTimer = null;
  }, 2200);
}

export function sheet(title: string, subtitle?: string): { root: HTMLElement; body: HTMLElement; footer: HTMLElement } {
  const root = el('div', 'sheet');
  const head = el('div', 'sheet__head');
  head.appendChild(el('h2', 'sheet__title', title));
  if (subtitle) head.appendChild(el('p', 'sheet__sub', subtitle));
  root.appendChild(head);
  const body = el('div', 'sheet__body');
  root.appendChild(body);
  const footer = el('div', 'sheet__footer');
  root.appendChild(footer);
  return { root, body, footer };
}