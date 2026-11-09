import { describe, expect, it } from 'vitest';
import indexHtml from '../index.html?raw';
import manifest from '../public/manifest.webmanifest?raw';
import namesDoc from '../specs/design/names-v2.md?raw';
import { REWARDED_ONBOARDING_FREE_MINUTES } from '../src/monetize/catalog';
import { CHARACTERS, ENEMIES, PASSIVES, WEAPONS } from '../src/sim/content';
import { COLD_OPEN_FRAMES, INTRO_ITEMS } from '../src/ui/intro';

/**
 * Files the flow ticket (#16) still owns and translates itself. Delete an entry
 * the moment #16 merges and its file is English; the list must only ever shrink.
 */
const FLOW_TICKET_FILES = new Set([
  '/src/game.ts',
  '/src/main.ts',
  '/src/ui/hud.ts',
  '/src/ui/menu.ts',
  '/src/ui/route.ts',
  '/src/ui/summary.ts',
]);

const SWEDISH_LETTERS = /[åäöÅÄÖ]/;

/** Everything a player can read: the game source, the shell page and the manifest. */
const FILES: Record<string, string> = {
  ...import.meta.glob<string>('/src/**/*.{ts,css}', { query: '?raw', import: 'default', eager: true }),
  '/index.html': indexHtml,
  '/public/manifest.webmanifest': manifest,
};

/** Lines that are only a comment are not user-facing; every other line is. */
function offendingLines(text: string): string[] {
  const hits: string[] = [];
  text.split('\n').forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')) return;
    if (SWEDISH_LETTERS.test(line)) hits.push(`${i + 1}: ${t.slice(0, 90)}`);
  });
  return hits;
}

describe('English only', () => {
  it('has no å, ä or ö in user-facing strings outside the flow ticket files', () => {
    const report: string[] = [];
    for (const [file, text] of Object.entries(FILES)) {
      if (FLOW_TICKET_FILES.has(file)) continue;
      for (const hit of offendingLines(text)) report.push(`${file}:${hit}`);
    }
    expect(report).toEqual([]);
  });

  it('keeps the allowlist honest: no entry is already English', () => {
    for (const rel of FLOW_TICKET_FILES) {
      // route.ts only exists once #16 lands; until then there is nothing to check.
      const text = FILES[rel];
      if (text === undefined) continue;
      const hits = offendingLines(text);
      // A file that is already English must leave the list, so the list only shrinks.
      expect(hits.length, `${rel} is English now: remove it from FLOW_TICKET_FILES`).toBeGreaterThan(0);
    }
  });
});

describe('names (specs/design/names-v2.md)', () => {
  const doc = namesDoc;
  const names = [
    ...Object.values(WEAPONS).flatMap((w) => [w.name, w.evolvedName]),
    ...Object.values(PASSIVES).map((p) => p.name),
    ...Object.values(CHARACTERS).map((c) => c.name),
    ...Object.values(ENEMIES).map((e) => e.name),
  ];

  it('lists every weapon, evolution, passive, character and enemy name', () => {
    for (const name of names) expect(doc, name).toContain(name);
  });

  it('uses the names the ticket fixed', () => {
    expect(WEAPONS.nyckel.name).toBe('Chain Wrench');
    expect(WEAPONS.korv.name).toBe('Nail Gun');
    expect(WEAPONS.telefon.name).toBe('Taser');
    expect(WEAPONS.spray.name).toBe('Torch Spray');
    expect(WEAPONS.vagn.name).toBe('Shopping Cart');
    expect(WEAPONS.ficklampa.name).toBe('Flashlight');
    expect(Object.values(ENEMIES).map((e) => e.name)).toEqual([
      'Shambler',
      'Crawler',
      'Runner',
      'Spitter',
      'Charger',
      'The Warden',
      'The Conductor',
    ]);
  });
});

describe('cold open and intro card', () => {
  it('has the four frames from the design spec', () => {
    expect(COLD_OPEN_FRAMES).toHaveLength(4);
    const text = COLD_OPEN_FRAMES.map((f) => f.lines.join(' '));
    expect(text[1]).toBe('Everyone else is gone. The bus still runs.');
    expect(text[3]).toBe('Find fuel. Keep moving.');
  });

  it('states the real ad rule of the gate, with no second-chance promise', () => {
    const ad = INTRO_ITEMS.find(([title]) => /ad/i.test(title));
    expect(ad).toBeDefined();
    expect(ad![1]).toContain(`${REWARDED_ONBOARDING_FREE_MINUTES} minutes`);
    expect(INTRO_ITEMS.flat().join(' ')).not.toMatch(/second chance|when you want/i);
  });
});
