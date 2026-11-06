/** Mute persistence. Corrupt or unavailable storage must never throw. */
export const AUDIO_STORE_KEY = 'sista-bussen.audio.v1';

interface AudioStore {
  muted: boolean;
  version: number;
}

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function loadMuted(): boolean {
  const s = storage();
  if (!s) return false;
  try {
    const raw = s.getItem(AUDIO_STORE_KEY);
    if (!raw) return false;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return false;
    return (parsed as { muted?: unknown }).muted === true;
  } catch {
    return false;
  }
}

export function saveMuted(muted: boolean): void {
  const s = storage();
  if (!s) return;
  const payload: AudioStore = { muted, version: 1 };
  try {
    s.setItem(AUDIO_STORE_KEY, JSON.stringify(payload));
  } catch {
    // Quota or private mode: the in-memory flag is still correct.
  }
}