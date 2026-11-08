v2 wave 1. Design: `specs/design/v2-last-bus.md` (sections Route, Materials, migration). Contract: `specs/tickets/v2-contract.md`. Pure logic and save only: no UI and no sim changes in this ticket.

## Acceptance criteria
- [ ] `src/sim/map.ts` exists, byte for byte as in the contract. Route code imports its types from there and never edits it.
- [ ] **Route generator** (`src/meta/route.ts`, pure):
  - A function takes `(routeSeed, segmentIndex)` and returns a 10-stop segment graph.
  - Each stop offers **2–4** next options; map 10 of every segment is a `boss` stop.
  - At most one `safe` stop per segment, never at position 1 or 10.
  - The stop type mix follows the design: street most common, then the resource stops, horde rare.
  - Deterministic: same seed and segment give the same graph.
  - Each option carries `danger` 1–3 and a `rewardHint: MaterialId | 'fuel'`.
- [ ] **MapConfig builder:**
  - Turns a chosen stop plus depth into a `MapConfig`, deriving the seed from the route seed and depth.
  - Quota and multipliers come from one table per stop type. Put that table in `src/meta/route.ts` as the single source; the sim ticket owns the base quota formula, so take it as a parameter or constant you can swap.
- [ ] **Route state:** current depth, last checkpoint (0, 10, 20, …), current segment seed, chosen path so far.
  - `applyMapResult` on extraction advances one stop and banks materials.
  - On death it resets to the last checkpoint and keeps banked materials. Materials picked up in the failed map are **lost**.
  - Clearing a boss sets a new checkpoint.
  - `safe` stops resolve without the sim: a small fixed material grant, defined in the table.
- [ ] **Save v3:**
  - New fields: `materials {scrap, parts, supplies}`, `route` state, `routeSeed`.
  - Forward migration from v2: Biljetter become Scrap at 1:1; `nightUnlocked`/`bestNight` map to `bestDepth`. Existing shop upgrade levels are kept as they are, for the later upgrade-tree ticket to map.
  - Corrupt-save fallback as today.
  - Migration test from a real v2 fixture.
- [ ] **Tests:** generator invariants over 1 000 seeds (option counts, boss placement, safe-stop rule), determinism, death/checkpoint/boss transitions, and the v2→v3 migration.
- [ ] `npm run build` and `npm test` are green, and the e2e suite still passes (the save change must not break the current game).

Out of scope: route map UI, upgrade trees, sim changes.
