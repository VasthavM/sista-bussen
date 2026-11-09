/**
 * Entry for the cold open. A separate module on purpose: it plays on the very
 * first launch, over the boot screen and the menu, without touching the game's
 * own entry (`main.ts`) or the menu. Settings replays it through `playColdOpen`.
 */
import { maybePlayColdOpen } from './ui/intro';

maybePlayColdOpen();
