/**
 * Audio entry point. WebAudio only, nothing loaded from the network, silent
 * until `unlock()` is called from a real user gesture.
 */
import { AudioEngineImpl } from './engine';

export type Sfx =
  | 'hit'
  | 'kill'
  | 'pickup_xp'
  | 'pickup_change'
  | 'levelup'
  | 'evolution'
  | 'hurt'
  | 'death'
  | 'revive'
  | 'win'
  | 'ui_click'
  | 'ui_buy'
  | 'ad_reward'
  | 'reroll';

export interface AudioEngine {
  /** Must be called from a real user-gesture handler. Safe to call repeatedly. */
  unlock(): void;
  play(sfx: Sfx): void;
  /** 0..1 wave pressure. Drives rain bed and sub-bass pulse. */
  setIntensity(value: number): void;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
  destroy(): void;
}

export function createAudio(): AudioEngine {
  return new AudioEngineImpl();
}

export { AUDIO_STORE_KEY } from './store';