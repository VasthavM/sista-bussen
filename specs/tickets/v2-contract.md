# v2 contract: route ↔ sim

Shared by the v2 wave-1 tickets (sim map objective, route + save v3). Totto owns this file. Workers don't
change it; request changes through Totto.

## The file

Both workers create `src/sim/map.ts` with **exactly** this content, byte for byte, as their first commit.
Identical add/add merges cleanly. Don't edit it afterwards. If you need a change, stop and ask Totto.

```ts
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
```

## Rules

- `depth` drives difficulty through the same curve shape as `nightDifficulty`, re-tuned later in the balance
  ticket. For wave 1, `depth` 1 must play like today's night 1, so the #11 harness baseline stays comparable.
- The sim never imports from `src/meta`. The route layer may import types from `src/sim/map.ts`.
- `RunConfig` (today's run input) keeps `character`, `weapon` and `mods`, and gains a `map: MapConfig` field.
  The sim worker owns that change.
