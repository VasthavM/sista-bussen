/**
 * The debug surface exposed on `window.__game`.
 *
 * Kept in its own type-only module so the runtime, the build and the e2e spec
 * share a single declaration. Gameplay never branches on it; it exists for
 * tests and console poking.
 */

import type { Game, GamePhase } from './game';
import type { RunSelection } from './ui/menu';

export interface GameDebugApi {
  getState(): ReturnType<Game['getState']>;
  grantXp(n: number): void;
  forceSpawn(type: Parameters<Game['forceSpawn']>[0]): void;
  startRun(opts?: Partial<RunSelection>): void;
  setPhase(phase: GamePhase): void;
  profile(): { tickets: number; nightUnlocked: number; bestNight: number; totalRuns: number };
  version: string;
}

declare global {
  interface Window {
    __game?: GameDebugApi;
  }
}