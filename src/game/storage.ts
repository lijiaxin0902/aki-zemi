import type { Game, Stats } from './types';

export const STORAGE_KEY = 'yume-supporters-v1';
export interface SavedData { version: 1; current: Game | null; results: Game[] }
export const emptySave = (): SavedData => ({ version: 1, current: null, results: [] });

function isGame(value: unknown): value is Game {
  if (!value || typeof value !== 'object') return false;
  const g = value as Game;
  const keys: (keyof Stats)[] = ['money', 'skill', 'support', 'health', 'satisfaction'];
  return typeof g.id === 'string' && typeof g.groupName === 'string'
    && (g.players === 5 || g.players === 6) && ['cafe', 'manga', 'music'].includes(g.dreamId)
    && Number.isInteger(g.round) && g.round >= 1 && g.round <= 6
    && ['planning', 'result', 'finished'].includes(g.status)
    && !!g.stats && keys.every(k => Number.isFinite(g.stats[k]) && g.stats[k] >= 0 && (k === 'money' || g.stats[k] <= 100))
    && Array.isArray(g.selectedActionIds) && g.selectedActionIds.every(x => typeof x === 'string')
    && Array.isArray(g.completedActions) && g.completedActions.every(x => typeof x === 'string')
    && Array.isArray(g.completedTasks) && g.completedTasks.every(x => typeof x === 'string')
    && Array.isArray(g.history) && g.history.every(r => !!r && typeof r.round === 'number' && Array.isArray(r.actionLabels) && typeof r.reaction === 'string' && r.before && r.after)
    && Array.isArray(g.reflections) && g.reflections.every(x => typeof x === 'string');
}

export function loadSaved(): { data: SavedData; warning: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { data: emptySave(), warning: '' };
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1 || !Array.isArray(parsed.results) || (parsed.current !== null && !isGame(parsed.current)) || !parsed.results.every((g: unknown) => isGame(g) && g.status === 'finished')) throw new Error('invalid save');
    return { data: parsed, warning: '' };
  } catch {
    return { data: emptySave(), warning: '保存データを読み込めませんでした。新しく始められます。ブラウザーの保存設定も確認してください。' };
  }
}

export function saveData(data: SavedData): boolean {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); return true; }
  catch { return false; }
}

export function removeData(): boolean {
  try { localStorage.removeItem(STORAGE_KEY); return true; }
  catch { return false; }
}

export function upsertResult(results: Game[], game: Game): Game[] {
  const existing = results.findIndex(r => r.id === game.id);
  if (existing < 0) return [...results, game];
  return results.map(r => r.id === game.id ? game : r);
}
