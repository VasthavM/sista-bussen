/** v2 contract between the route layer (src/meta) and the sim. Owned by Totto: change only via the contract. */

export type MaterialId = 'scrap' | 'parts' | 'supplies';

export type StopType =
  | 'street'
  | 'gas_station'
  | 'scrapyard'
  | 'pharmacy'
  | 'depot'
  | 'horde'
  | 'safe'
  | 'boss';

export type Materials = Readonly<Record<MaterialId, number>>;

/** Everything the sim needs to play one map. Produced by the route layer. */
export interface MapConfig {
  /** Seed for this map's RNG. Same config → same map. */
  readonly seed: number;
  /** 1-based index along the route; replaces `night` as the difficulty input. */
  readonly depth: number;
  /** Never 'safe': safe stops have no combat and never reach the sim. */
  readonly stop: Exclude<StopType, 'safe'>;
  /** Fuel needed before extraction opens. */
  readonly fuelQuota: number;
  /** Multipliers on material drops for this stop (1 = baseline). */
  readonly materialMultiplier: Materials;
  /** Multiplier on enemy density (horde > 1). */
  readonly densityMultiplier: number;
}

/** What one map produced. Consumed by the route layer. */
export interface MapResult {
  readonly outcome: 'extracted' | 'died';
  /** Seconds of sim time when the map ended. */
  readonly time: number;
  readonly fuelCollected: number;
  /** Materials picked up. On 'died' the route layer decides what is kept. */
  readonly materials: Materials;
  readonly kills: number;
}
