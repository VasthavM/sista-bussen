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
  /** End the current run immediately; the summary opens on the next frame. */
  endRun(): void;
  /** Fill the fuel gauge and put the player on the bus; the next sim step extracts through the normal path. */
  completeObjective(): void;
  /** Set current HP without touching max HP. */
  setHp(n: number): void;
  /** Enemies inside the camera frame right now. */
  onScreenEnemies(): number;
  /** Distance to the closest enemy, Infinity when empty. */
  closestEnemy(): number;
  startRun(opts?: Partial<RunSelection>): void;
  setPhase(phase: GamePhase): void;
  /** Add Biljetter to the profile (test/debug grants, never gameplay). */
  grantTickets(n: number): void;
  profile(): {
    tickets: number;
    nightUnlocked: number;
    bestNight: number;
    totalRuns: number;
    weaponTokens: number;
    upgrades: Record<string, number>;
  };
  version: string;
}

declare global {
  interface Window {
    __game?: GameDebugApi;
  }
}