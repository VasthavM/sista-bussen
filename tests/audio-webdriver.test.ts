import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioEngineImpl } from '../src/audio/engine';

describe('audio under automation', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('never creates an AudioContext when navigator.webdriver is true, and leaves the mute setting alone', () => {
    const ctor = vi.fn();
    vi.stubGlobal('window', { AudioContext: ctor });
    vi.stubGlobal('navigator', { webdriver: true });
    const engine = new AudioEngineImpl();
    engine.unlock();
    engine.play('hit');
    expect(ctor).not.toHaveBeenCalled();
    expect(engine.isMuted()).toBe(false);
  });
});
