/** Route-to-map glue shared by the game flow and its tests. Pure: no DOM, no storage. */

import { SEGMENT_LENGTH, buildMapConfig, type StopOption } from './meta/route';
import type { MapConfig, Materials } from './sim/map';
import { fuelQuotaFor } from './sim/objective';

/** Stop number inside the current segment, 1..SEGMENT_LENGTH. */
export const stopInSegment = (depth: number): number => ((depth - 1) % SEGMENT_LENGTH) + 1;

/**
 * The MapConfig for one route option. The quota comes from the sim's `fuelQuotaFor`.
 * Boss stops play as a horde stop until the boss ticket: the sim spawns its fixed-time
 * bosses only on `stop: 'boss'`, and those are the old night bosses.
 */
export function mapConfigFor(option: StopOption, depth: number, routeSeed: number): MapConfig {
  const config = buildMapConfig(option, depth, routeSeed, fuelQuotaFor);
  return option.type === 'boss' ? { ...config, stop: 'horde' } : config;
}

export const addMaterials = (a: Materials, b: Materials): Materials => ({
  scrap: a.scrap + b.scrap,
  parts: a.parts + b.parts,
  supplies: a.supplies + b.supplies,
});

/** m:ss, no hours: a map never runs that long. */
export function elapsedLabel(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
