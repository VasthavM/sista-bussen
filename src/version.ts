/**
 * Build identity. Injected by Vite (`define` in vite.config.ts) from package.json +
 * the current git SHA. Never hand-maintain a version string anywhere else: settings and
 * the boot screen both render through this module.
 */

declare const __SB_APP_VERSION__: string | undefined;
declare const __SB_BUILD_SHA__: string | undefined;

export const APP_VERSION: string = typeof __SB_APP_VERSION__ === 'undefined' ? '1.0.0' : __SB_APP_VERSION__;
export const BUILD_SHA: string = typeof __SB_BUILD_SHA__ === 'undefined' ? 'dev' : __SB_BUILD_SHA__;

/** Human-readable "version · build" line used on the boot screen and in settings. */
export function versionLine(build: string = BUILD_SHA): string {
  return `v${APP_VERSION} · ${build}`;
}
