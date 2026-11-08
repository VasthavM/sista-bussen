import { defaultMapConfig } from '../src/sim/objective';
import type { MapConfig } from '../src/sim/map';
import { EMPTY_MODS, type RunConfig } from '../src/sim/types';

/** A street map at `depth` with the default quota and neutral multipliers. */
export function mapConfig(seed: number, depth = 1, over: Partial<MapConfig> = {}): MapConfig {
  return { ...defaultMapConfig(seed, depth), ...over };
}

export function runConfig(seed: number, depth = 1, over: Partial<MapConfig> = {}): RunConfig {
  return { character: 'nattvandraren', weapon: 'nyckel', mods: { ...EMPTY_MODS }, map: mapConfig(seed, depth, over) };
}
