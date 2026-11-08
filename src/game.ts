/**
 * Run orchestration: fixed-step sim driving, input, hitstop, pause/resume, level-up
 * cards, death/win summary and the payout. Rendering, camera and shake live behind
 * the `Renderer` interface from `src/render`; nothing here draws pixels.
 */

import { track } from './analytics';
import type { AudioEngine, Sfx } from './audio';
import type { Renderer, ViewState } from './render';
import { applyRunOutcome, computePayout, vipActive, type Payout } from './meta/economy';
import type { Profile } from './meta/save';
import { modsFromProfile } from './meta/shop';
import { adsOfferable, shouldShowInterstitial } from './monetize/ads';
import { AD_PLACEMENTS } from './monetize/catalog';
import { CHARACTERS, ENEMIES, WEAPONS } from './sim/content';
import { RUN_DURATION } from './sim/curve';
import { defaultMapConfig } from './sim/objective';
import { spawnAtRing } from './sim/spawn';
import { addXp, clearEvents, computeMapResult, computeRunResult, createRun, revivePlayer } from './sim/state';
import { NO_INPUT, stepRun, type MoveInput } from './sim/step';
import type {
  CharacterId,
  EnemyType,
  RunConfig,
  RunStatus,
  SimEvent,
  SimState,
  UpgradeChoice,
  WeaponId,
} from './sim/types';
import { applyChoiceById, rollChoices } from './sim/upgrades';
import type { AdGate } from './ui/adOverlay';
import { mountHud, openPause, type Hud } from './ui/hud';
import { createInput, type InputController } from './ui/input';
import { openLevelUp } from './ui/levelup';
import type { OverlayHandle, OverlayHost } from './ui/overlay';
import { mountSummary, type SummaryData, type SummaryView } from './ui/summary';

const FIXED_DT = 1 / 60;
const MAX_STEPS = 5;
const MAX_FRAME_DT = 0.1;

export type GamePhase = 'menu' | 'run' | 'levelup' | 'summary' | 'pause';

export interface RunSelection {
  night: number;
  character: CharacterId;
  weapon: WeaponId;
}

export interface GameDeps {
  canvas: HTMLCanvasElement;
  renderer: Renderer;
  uiRoot: HTMLElement;
  overlay: OverlayHost;
  profile: Profile;
  audio: AudioEngine;
  gate: AdGate;
  persist(): void;
  onProfileChanged(): void;
  onExitToMenu(): void;
  /** The run summary is showing: a waiting app update may be re-offered (never applied). */
  onRunSummary?(): void;
}

export interface DebugState {
  elapsed: number;
  phase: GamePhase;
  night: number;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  enemies: number;
  weapons: Array<{ id: WeaponId; level: number; evolved: boolean }>;
  kills: number;
  status: RunStatus;
  change: number;
  fuel: number;
  fuelQuota: number;
  quotaMet: boolean;
  materials: { scrap: number; parts: number; supplies: number };
  revivesUsed: number;
}

export class Game {
  private state: SimState | null = null;
  private input: InputController;
  private hud: Hud | null = null;
  private levelHandle: OverlayHandle | null = null;
  private summaryView: SummaryView | null = null;
  private pauseHandle: OverlayHandle | null = null;

  private phase: GamePhase = 'menu';
  private selection: RunSelection = { night: 1, character: 'nattvandraren', weapon: 'nyckel' };

  private raf = 0;
  private lastTs = 0;
  private accumulator = 0;
  private hitstop = 0;

  private rerollsUsed = 0;
  private doubleFares = false;
  private finalized = false;
  private lastPayout: Payout | null = null;
  private reviveOfferedAt = -1;
  private audioGate = 0;
  private lastHitSfx = 0;
  private lastKillSfx = 0;

  private readonly view: ViewState = {
    cameraX: 0,
    cameraY: 0,
    shakeX: 0,
    shakeY: 0,
    stick: null,
    paused: true,
    dimmed: false,
    dt: 0,
    elapsed: 0,
  };

  constructor(private deps: GameDeps) {
    this.input = createInput(deps.canvas);
    this.input.setEnabled(false);
    window.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.raf = requestAnimationFrame(this.frame);
  }

  // ---- public API ----

  startRun(selection: Partial<RunSelection> = {}): void {
    this.teardownRun();
    const profile = this.deps.profile;
    const night = Math.max(1, Math.min(profile.nightUnlocked, Math.floor(selection.night ?? this.selection.night ?? 1)));
    const character = selection.character ?? this.selection.character;
    const weapon = selection.weapon ?? this.selection.weapon;
    this.selection = { night, character, weapon };

    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    const config: RunConfig = {
      character,
      weapon,
      mods: modsFromProfile(profile),
      map: defaultMapConfig(seed, night),
    };
    this.state = createRun(config);
    this.hud = mountHud({
      root: this.deps.uiRoot,
      onPause: () => this.openPauseSheet(),
    });
    this.input.setEnabled(true);
    this.input.reset();
    this.phase = 'run';
    this.accumulator = 0;
    this.hitstop = 0;
    this.lastTs = 0;
    this.rerollsUsed = 0;
    this.doubleFares = false;
    this.finalized = false;
    this.lastPayout = null;
    this.reviveOfferedAt = -1;

    track('run_start', {
      night,
      character,
      weapon,
      seed,
      tickets: profile.tickets,
    });
  }

  /** Leave whatever is on screen and go back to Kuren (already finalised or not started). */
  toMenu(): void {
    this.teardownRun();
    this.phase = 'menu';
  }

  getState(): DebugState {
    const s = this.state;
    if (!s) {
      return {
        elapsed: 0,
        phase: this.phase,
        night: 0,
        hp: 0,
        maxHp: 0,
        level: 0,
        xp: 0,
        enemies: 0,
        weapons: [],
        kills: 0,
        status: 'running',
        change: 0,
        fuel: 0,
        fuelQuota: 0,
        quotaMet: false,
        materials: { scrap: 0, parts: 0, supplies: 0 },
        revivesUsed: 0,
      };
    }
    return {
      elapsed: s.time,
      phase: this.phase,
      night: s.config.map.depth,
      hp: Math.max(0, Math.round(s.player.hp)),
      maxHp: Math.round(s.player.maxHp),
      level: s.level,
      xp: Math.round(s.xp),
      enemies: s.enemies.length,
      weapons: s.weapons.map((w) => ({ id: w.id, level: w.level, evolved: w.evolved })),
      kills: s.kills,
      status: s.status,
      change: Math.floor(s.change),
      fuel: Math.floor(s.fuel),
      fuelQuota: s.config.map.fuelQuota,
      quotaMet: s.quotaMet,
      materials: {
        scrap: Math.floor(s.materials.scrap),
        parts: Math.floor(s.materials.parts),
        supplies: Math.floor(s.materials.supplies),
      },
      revivesUsed: s.revivesUsed,
    };
  }

  grantXp(amount: number): void {
    if (!this.state) return;
    addXp(this.state, Math.max(0, Math.floor(amount)));
  }

  forceSpawn(type: EnemyType): void {
    if (!this.state) return;
    spawnAtRing(this.state, type, false);
  }

  /** Debug/e2e: end the run immediately; the summary opens on the next frame. */
  endRun(): void {
    const s = this.state;
    if (!s || s.status !== 'running') return;
    s.player.hp = 0;
    s.status = 'dead';
    this.accumulator = 0;
    this.hitstop = 0;
  }

  /** Debug/e2e: meet the fuel quota and stand on the bus; the next step extracts via the real path. */
  completeObjective(): void {
    const s = this.state;
    if (!s || s.status !== 'running') return;
    s.fuel = Math.max(s.fuel, s.config.map.fuelQuota);
    s.player.x = s.bus.x;
    s.player.y = s.bus.y;
  }

  /** Debug/e2e: set current HP without touching max HP. */
  setHp(hp: number): void {
    const s = this.state;
    if (!s) return;
    s.player.hp = Math.max(0, Math.min(s.player.maxHp, Math.floor(hp)));
  }

  /** Debug/e2e: enemies inside the camera frame right now. */
  onScreenEnemies(): number {
    const s = this.state;
    if (!s) return 0;
    const { halfW, halfH } = this.deps.renderer.viewBounds();
    let count = 0;
    for (const e of s.enemies) {
      if (Math.abs(e.x - s.player.x) <= halfW + e.radius && Math.abs(e.y - s.player.y) <= halfH + e.radius) {
        count += 1;
      }
    }
    return count;
  }

  /** Debug/e2e: distance to the closest enemy, or Infinity when the street is empty. */
  closestEnemy(): number {
    const s = this.state;
    if (!s) return Number.POSITIVE_INFINITY;
    let best = Number.POSITIVE_INFINITY;
    for (const e of s.enemies) {
      best = Math.min(best, Math.hypot(e.x - s.player.x, e.y - s.player.y));
    }
    return best;
  }

  setPhase(phase: GamePhase): void {
    if (phase === 'menu') {
      this.finalizeRun();
      this.toMenu();
      this.deps.onExitToMenu();
      return;
    }
    if (!this.state) {
      if (phase === 'run') this.startRun();
      return;
    }
    if (phase === 'levelup') {
      if (!this.levelHandle) this.openLevelUp();
      return;
    }
    if (phase === 'summary') {
      this.openSummary(this.state.status === 'extracted');
      return;
    }
    if (phase === 'pause') {
      this.openPauseSheet();
      return;
    }
    this.closePauseSheet();
    this.phase = 'run';
  }

  setSelection(selection: Partial<RunSelection>): void {
    this.selection = { ...this.selection, ...selection };
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.teardownRun();
    this.input.destroy();
  }

  // ---- frame loop ----

  private frame = (ts: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const state = this.state;
    if (!state) {
      this.lastTs = ts;
      return;
    }

    const seconds = ts / 1000;
    const raw = this.lastTs > 0 ? seconds - this.lastTs : FIXED_DT;
    this.lastTs = seconds;
    const dt = Math.min(MAX_FRAME_DT, Math.max(0, raw));

    const hidden = typeof document !== 'undefined' && document.hidden;
    const dimmed = this.deps.overlay.open;
    const blocked = hidden || dimmed || this.phase !== 'run';
    this.input.setEnabled(!blocked);

    if (!blocked) {
      this.deps.profile.playtimeSeconds += dt;
      this.advance(dt);
      this.checkTransitions();
    } else {
      // Never queue up sim work while paused; a backgrounded tab must not spiral.
      this.accumulator = 0;
    }

    this.consumeEvents();
    this.decayShake(dt);
    this.updateAudioIntensity();
    this.hud?.update(state);
    this.draw(dt, blocked, dimmed);
  };

  private advance(dt: number): void {
    const state = this.state;
    if (!state) return;

    if (this.hitstop > 0) {
      this.hitstop = Math.max(0, this.hitstop - dt);
      this.accumulator = 0;
      return;
    }

    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < MAX_STEPS) {
      const input: MoveInput = this.input.read();
      stepRun(state, FIXED_DT, input);
      this.accumulator -= FIXED_DT;
      steps += 1;
      if (this.hitstop > 0 || state.status !== 'running') {
        this.accumulator = 0;
        break;
      }
    }
    if (this.accumulator > FIXED_DT * MAX_STEPS) this.accumulator = 0;
  }

  private draw(dt: number, paused: boolean, dimmed: boolean): void {
    const state = this.state;
    if (!state) return;
    const player = state.player;

    const view = this.view;
    view.cameraX = player.x;
    view.cameraY = player.y;
    view.shakeX = (Math.random() * 2 - 1) * state.shake;
    view.shakeY = (Math.random() * 2 - 1) * state.shake;
    view.stick = this.input.stick();
    view.paused = paused;
    view.dimmed = dimmed;
    view.dt = dt;
    view.elapsed = state.time;

    this.deps.renderer.drawFrame(state, view);
    // The renderer may consume the event pool during drawFrame; clearing afterwards
    // keeps transient effects to exactly one frame.
    clearEvents(state);
  }

  private decayShake(dt: number): void {
    const state = this.state;
    if (!state || state.shake <= 0) return;
    state.shake *= Math.exp(-6.5 * dt);
    if (state.shake < 0.06) state.shake = 0;
  }

  private updateAudioIntensity(): void {
    const state = this.state;
    if (!state) return;
    this.audioGate += 1;
    if (this.audioGate % 15 !== 0) return;
    const hpFrac = state.player.maxHp > 0 ? state.player.hp / state.player.maxHp : 0;
    const pressure = Math.min(1, 0.2 + (state.time / RUN_DURATION) * 0.55 + (1 - hpFrac) * 0.3);
    this.deps.audio.setIntensity(pressure);
  }

  // ---- sim events: feedback, audio, hitstop ----

  private consumeEvents(): void {
    const state = this.state;
    if (!state || state.eventCount === 0) return;
    const now = performance.now();

    for (let i = 0; i < state.eventCount; i++) {
      const event = state.events[i];
      switch (event.type) {
        case 'kill': {
          const significance = event.value >= 160 ? 2.6 : event.value >= 20 ? 1.5 : 1;
          this.hitstop = Math.min(0.28, Math.max(this.hitstop, 0.09 * significance));
          if (now - this.lastKillSfx > 55) {
            this.lastKillSfx = now;
            this.deps.audio.play('kill');
          }
          break;
        }
        case 'hit': {
          if (now - this.lastHitSfx > 70) {
            this.lastHitSfx = now;
            this.deps.audio.play('hit');
          }
          break;
        }
        case 'hurt':
          this.deps.audio.play('hurt');
          this.vibrate(24);
          break;
        case 'levelup':
          this.deps.audio.play('levelup');
          break;
        case 'evolve':
          this.deps.audio.play('evolution');
          this.hud?.announce(event.text || 'UTVECKLING', 'good');
          break;
        case 'pickup':
          this.deps.audio.play(event.text === 'xp' ? 'pickup_xp' : 'pickup_change');
          break;
        case 'boss':
          this.hud?.announce(event.text || 'BOSS', 'boss');
          break;
        case 'horn':
          this.deps.audio.play('horn');
          this.hud?.announce('BUSSEN VÄNTAR', 'good');
          break;
        case 'win':
          this.deps.audio.play('win');
          this.hud?.announce('ALLA OMBORD', 'good');
          break;
        case 'revive':
          this.deps.audio.play('ad_reward');
          break;
        default:
          break;
      }
    }
  }

  private vibrate(ms: number): void {
    if (!this.deps.profile.settings.haptics) return;
    if (typeof navigator === 'undefined' || !navigator.vibrate) return;
    try {
      navigator.vibrate(ms);
    } catch {
      /* vibration is a nicety */
    }
  }

  // ---- transitions ----

  private checkTransitions(): void {
    const state = this.state;
    if (!state) return;
    if (state.status === 'dead' || state.status === 'extracted') {
      if (!this.summaryView) this.openSummary(state.status === 'extracted');
      return;
    }
    if (state.pendingLevelUps > 0 && !this.levelHandle) this.openLevelUp();
  }

  // ---- level up ----

  private openLevelUp(): void {
    const state = this.state;
    if (!state || this.summaryView) return;
    this.input.reset();
    const choices: UpgradeChoice[] = rollChoices(state, 3);
    if (choices.length === 0) {
      // Nothing left to offer: bank the level and move on.
      state.pendingLevelUps = 0;
      return;
    }
    this.phase = 'levelup';
    this.levelHandle = openLevelUp({
      host: this.deps.overlay,
      audio: this.deps.audio,
      state,
      choices,
      adsOfferable: adsOfferable(this.deps.profile),
      adRerollsLeft: Math.max(0, AD_PLACEMENTS.reroll.cap - this.rerollsUsed),
      adRerollCap: AD_PLACEMENTS.reroll.cap,
      onPick: (id) => this.pickChoice(id, choices),
      onReroll: () => void this.rerollAd(),
    });
  }

  private pickChoice(id: string, choices: UpgradeChoice[]): void {
    const state = this.state;
    if (!state) return;
    const choice = choices.find((c) => c.id === id);
    applyChoiceById(state, id, choices);
    if (choice) {
      if (choice.kind === 'evolution' && choice.weaponId) {
        track('evolution', { weapon: choice.weaponId, level: state.level, night: state.config.map.depth });
        this.hud?.announce(`${WEAPONS[choice.weaponId].evolvedName}`, 'good');
      }
      track('level_up', {
        level: state.level,
        choice: choice.id,
        kind: choice.kind,
        rerolled: this.rerollsUsed > 0,
      });
    }
    this.closeLevelUp();
    if (state.pendingLevelUps > 0) this.openLevelUp();
  }

  private async rerollAd(): Promise<void> {
    const state = this.state;
    if (!state || !this.levelHandle) return;
    if (this.rerollsUsed >= AD_PLACEMENTS.reroll.cap) return;
    this.phase = 'levelup';
    const outcome = await this.deps.gate.run('reroll');
    if (!outcome.completed) {
      this.closeLevelUp();
      this.openLevelUp();
      return;
    }
    this.rerollsUsed += 1;
    this.deps.audio.play('reroll');
    this.closeLevelUp();
    this.openLevelUp();
  }

  private closeLevelUp(): void {
    if (this.levelHandle) {
      const handle = this.levelHandle;
      this.levelHandle = null;
      handle.close();
    }
    if (this.phase === 'levelup') this.phase = 'run';
    this.accumulator = 0;
  }

  // ---- summary / payout ----

  private summaryData(): SummaryData {
    const state = this.state!;
    const profile = this.deps.profile;
    const won = state.status === 'extracted';
    const payout = computePayout({
      change: state.change,
      night: state.config.map.depth,
      won,
      doubleFares: this.doubleFares,
      vip: vipActive(profile),
      metaFares: modsFromProfile(profile).fares,
    });
    return {
      won,
      night: state.config.map.depth,
      survived: state.time,
      kills: state.kills,
      level: state.level,
      fuel: Math.floor(state.fuel),
      fuelQuota: state.config.map.fuelQuota,
      materials: computeMapResult(state).materials,
      change: payout.change,
      tickets: payout.tickets,
      nightBonus: payout.nightBonus,
      doubleFares: this.doubleFares,
      revivesLeft: Math.max(0, AD_PLACEMENTS.revive.cap - state.revivesUsed),
      revivesUsed: state.revivesUsed,
      nextNightUnlocked: won,
      adsOfferable: adsOfferable(profile),
    };
  }

  private openSummary(won: boolean): void {
    const state = this.state;
    if (!state) return;
    if (this.summaryView) {
      this.summaryView.update(this.summaryData());
      return;
    }
    this.phase = 'summary';
    this.input.reset();
    this.deps.persist(); // run end: bank playtime even if the app is closed on this screen
    this.deps.onRunSummary?.();
    if (adsOfferable(this.deps.profile) && !won && this.reviveOfferedAt !== state.revivesUsed) {
      this.reviveOfferedAt = state.revivesUsed;
      track('revive_offered', {
        night: state.config.map.depth,
        time: state.time,
        remaining: Math.max(0, AD_PLACEMENTS.revive.cap - state.revivesUsed),
      });
    }
    this.summaryView = mountSummary(
      {
        host: this.deps.overlay,
        audio: this.deps.audio,
        onRevive: () => void this.acceptRevive(),
        onDoubleFares: () => void this.acceptDoubleFares(),
        onRetry: () => this.retry(),
        onExit: () => void this.quitToMenu(),
      },
      this.summaryData(),
    );
  }

  private closeSummary(): void {
    if (this.summaryView) {
      const view = this.summaryView;
      this.summaryView = null;
      view.handle.close();
    }
    if (this.phase === 'summary') this.phase = 'run';
  }

  private async acceptRevive(): Promise<void> {
    const state = this.state;
    if (!state || state.status !== 'dead') return;
    const remaining = Math.max(0, AD_PLACEMENTS.revive.cap - state.revivesUsed);
    if (remaining <= 0) return;
    this.summaryView?.busy(true);
    const outcome = await this.deps.gate.run('revive');
    this.summaryView?.busy(false);
    if (!outcome.completed) return;
    if (!revivePlayer(state)) return;

    track('revive_taken', { night: state.config.map.depth, time: state.time, remaining });
    this.deps.audio.play('ad_reward');
    this.closeSummary();
    this.accumulator = 0;
    this.hitstop = 0;
    this.phase = 'run';
  }

  private async acceptDoubleFares(): Promise<void> {
    const state = this.state;
    if (!state || this.doubleFares) return;
    this.summaryView?.busy(true);
    const outcome = await this.deps.gate.run('double_fares');
    this.summaryView?.busy(false);
    if (!outcome.completed) return;
    this.doubleFares = true;
    this.deps.audio.play('ad_reward');
    this.summaryView?.update(this.summaryData());
  }

  private retry(): void {
    const won = this.state?.status === 'extracted';
    const previous = this.selection;
    this.finalizeRun();
    this.closeSummary();
    const nextNight = won
      ? Math.min(this.deps.profile.nightUnlocked, previous.night + 1)
      : previous.night;
    this.startRun({ ...previous, night: nextNight });
  }

  private async quitToMenu(): Promise<void> {
    this.finalizeRun();
    this.closeSummary();
    this.toMenu();
    this.setPhase('menu');
    await this.maybeInterstitial();
    this.deps.onExitToMenu();
  }

  private finalizeRun(): Payout | null {
    const state = this.state;
    if (!state) return this.lastPayout;
    if (this.finalized) return this.lastPayout;
    const won = state.status === 'extracted';
    const result = computeRunResult(state);
    const payout = computePayout({
      change: result.change,
      night: result.night,
      won,
      doubleFares: this.doubleFares,
      vip: vipActive(this.deps.profile),
      metaFares: modsFromProfile(this.deps.profile).fares,
    });
    applyRunOutcome(this.deps.profile, result, payout);
    this.finalized = true;
    this.lastPayout = payout;
    this.deps.persist();
    this.deps.onProfileChanged();
    track('run_end', {
      night: result.night,
      won,
      time: result.time,
      kills: result.kills,
      level: result.level,
      change: result.change,
      revives: result.revivesUsed,
      doubleFares: this.doubleFares,
    });
    return payout;
  }

  private async maybeInterstitial(): Promise<void> {
    const profile = this.deps.profile;
    const now = Date.now();
    const show = shouldShowInterstitial(
      {
        completedRuns: profile.totalRuns,
        runsSinceInterstitial: profile.runsSinceInterstitial,
        lastInterstitialAt: profile.lastInterstitialAt,
        inRun: false,
        removeAds: profile.removeAds,
      },
      now,
    );
    if (!show) return;
    await this.deps.gate.showInterstitial();
    profile.runsSinceInterstitial = 0;
    profile.lastInterstitialAt = now;
    this.deps.persist();
  }

  // ---- pause ----

  private openPauseSheet(): void {
    if (!this.state || this.pauseHandle) return;
    this.input.reset();
    this.pauseHandle = openPause(this.deps.overlay, {
      audio: this.deps.audio,
      muted: this.deps.profile.settings.muted,
      onToggleMute: () => {
        const muted = !this.deps.profile.settings.muted;
        this.deps.profile.settings.muted = muted;
        this.deps.audio.setMuted(muted);
        this.deps.persist();
        return muted;
      },
      onResume: () => this.closePauseSheet(),
      onQuit: () => void this.quitToMenu(),
    });
  }

  private closePauseSheet(): void {
    if (!this.pauseHandle) return;
    const handle = this.pauseHandle;
    this.pauseHandle = null;
    handle.close();
    this.accumulator = 0;
  }

  private togglePause(): void {
    if (this.pauseHandle) this.closePauseSheet();
    else this.openPauseSheet();
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.code !== 'Escape' && event.code !== 'KeyP') return;
    if (!this.state) return;
    event.preventDefault();
    if (this.deps.overlay.open) {
      // Dismissible overlays close; modal ones (cards, ads, summary) ignore Esc.
      this.deps.overlay.dismissTop();
      return;
    }
    this.togglePause();
  };

  private onVisibility = (): void => {
    if (typeof document === 'undefined' || !document.hidden) return;
    this.deps.persist();
    if (this.state && this.phase === 'run' && !this.deps.overlay.open) this.openPauseSheet();
  };

  // ---- teardown ----

  private teardownRun(): void {
    if (this.levelHandle) {
      const handle = this.levelHandle;
      this.levelHandle = null;
      handle.close();
    }
    if (this.summaryView) {
      const view = this.summaryView;
      this.summaryView = null;
      view.handle.close();
    }
    if (this.pauseHandle) {
      const handle = this.pauseHandle;
      this.pauseHandle = null;
      handle.close();
    }
    this.hud?.destroy();
    this.hud = null;
    this.state = null;
    this.accumulator = 0;
    this.hitstop = 0;
    this.lastTs = 0;
    this.input.setEnabled(false);
    this.input.reset();
    this.deps.audio.setIntensity(0);
  }
}

/** Convenience for the debug API: a readable weapon list without touching gameplay. */
export function describeWeapons(state: SimState | null): string {
  if (!state) return '';
  return state.weapons.map((w) => `${WEAPONS[w.id].name} ${w.level}${w.evolved ? '★' : ''}`).join(', ');
}

/** Enemy labels, used by the summary and tooltips. */
export function enemyLabel(type: EnemyType): string {
  return ENEMIES[type].name;
}

/** Kept for symmetry with the content module; characters are picked in the menu. */
export function characterLabel(id: CharacterId): string {
  return CHARACTERS[id].name;
}

/** Type re-export so callers do not need to import sim types directly. */
export type { SimEvent };