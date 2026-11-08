**Added scope (Max, 2026-11-08): choosing the starting weapon must be obvious.**

The picker already exists (`Vad har du i fickan?` in `src/ui/menu.ts`, wired through `RunSelection.weapon` into the sim), but it sits below the fold and Max never found it. Extra acceptance criteria:

- [ ] Character and starting weapon are both choosable from the first screen without scrolling at 375×667, as a compact loadout row directly above `ÅK UT I NATTEN`, or as a loadout sheet opened by one tap on that row.
- [ ] Each weapon option shows its name, a one-line behaviour (from `src/sim/content.ts`, never retyped) and a locked state that routes to the shop's weapons tab.
- [ ] The last chosen character and weapon persist across reloads (a menu-level preference, not a sim change).
- [ ] The e2e picks a non-default weapon and asserts the run starts with it (via `window.__game` state).
