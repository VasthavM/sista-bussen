import { describe, expect, it } from 'vitest';
import { LOADOUT_KEY, loadLoadout, saveLoadout } from '../src/ui/loadout';

const UNLOCKED = ['nyckel', 'korv', 'spray', 'ficklampa'] as const;
const unlocked = (id: string) => (UNLOCKED as readonly string[]).includes(id);

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

describe('menu loadout preference', () => {
  it('defaults to Nattvandraren and the first unlocked weapon when nothing is stored', () => {
    expect(loadLoadout(fakeStorage(), unlocked)).toEqual({ character: 'nattvandraren', weapon: 'nyckel' });
  });

  it('round-trips a saved choice', () => {
    const storage = fakeStorage();
    saveLoadout(storage, { character: 'studenten', weapon: 'korv' });
    expect(loadLoadout(storage, unlocked)).toEqual({ character: 'studenten', weapon: 'korv' });
  });

  it('falls back per field when a stored weapon is locked or ids are unknown', () => {
    const storage = fakeStorage({ [LOADOUT_KEY]: JSON.stringify({ character: 'pensionaren', weapon: 'vagn' }) });
    expect(loadLoadout(storage, unlocked)).toEqual({ character: 'pensionaren', weapon: 'nyckel' });
    const junk = fakeStorage({ [LOADOUT_KEY]: JSON.stringify({ character: 'x', weapon: 7 }) });
    expect(loadLoadout(junk, unlocked)).toEqual({ character: 'nattvandraren', weapon: 'nyckel' });
  });

  it('survives corrupt JSON and throwing storage', () => {
    expect(loadLoadout(fakeStorage({ [LOADOUT_KEY]: '{nope' }), unlocked).character).toBe('nattvandraren');
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(loadLoadout(broken, unlocked).weapon).toBe('nyckel');
    expect(() => saveLoadout(broken, { character: 'studenten', weapon: 'korv' })).not.toThrow();
  });
});
