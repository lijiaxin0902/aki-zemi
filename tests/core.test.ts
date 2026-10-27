import test from 'node:test';
import assert from 'node:assert/strict';
import { DREAMS, RULES } from '../src/game/data';
import {
  chooseStrategy, createGame, executePlan, finishGame, getActions, getEnding,
  getProgress, isGoalComplete, nextRound, previewPlan, toggleAction,
} from '../src/game/engine';
import type { DreamId, Game } from '../src/game/types';

const start = (dreamId: DreamId = 'cafe') => createGame('テスト班', 6, dreamId);
const select = (game: Game, ids: string[]) => ids.reduce((current, id) => toggleAction(current, id), game);
const execute = (game: Game, ids: string[], strategy?: string): Game => {
  let planned = select(game, ids);
  if (strategy) planned = chooseStrategy(planned, strategy);
  const preview = previewPlan(planned);
  assert.equal(preview.valid, true, `Round ${game.round}: ${preview.reasons.join(' / ')}`);
  const result = executePlan(planned);
  assert.equal(result.history.length, game.history.length + 1);
  assert.deepEqual(result.stats, preview.stats, 'the actual settlement must match the preview');
  return result;
};

test('all scenarios provide the same starting resources, three configured stages and six fixed events', () => {
  assert.equal(DREAMS.length, 3);
  for (const dream of DREAMS) {
    const game = start(dream.id);
    assert.deepEqual(game.stats, { money: 100, skill: 20, support: 20, health: 70, satisfaction: 70 });
    assert.equal(dream.stages.length, 3);
    assert.equal(dream.events.length, RULES.rounds);
    assert.ok(dream.actions.length >= 8);
    assert.equal(dream.strategies.length, 2);
    assert.equal(getProgress(game).percent, 0);
  }
});

test('selecting, cancelling and previewing never charge resources or modify the original state', () => {
  const original = start();
  const snapshot = JSON.stringify(original);
  const selected = toggleAction(original, 'study');
  assert.deepEqual(selected.selectedActionIds, ['study']);
  assert.deepEqual(selected.stats, original.stats);
  const first = previewPlan(selected);
  assert.deepEqual(previewPlan(selected), first);
  const cancelled = toggleAction(selected, 'study');
  assert.deepEqual(cancelled.selectedActionIds, []);
  assert.deepEqual(cancelled.stats, original.stats);
  assert.equal(JSON.stringify(original), snapshot);
});

test('a round is settled once, including on duplicate execute and next-round clicks', () => {
  const selected = select(start(), ['study', 'consult']);
  const result = executePlan(selected);
  assert.equal(result.status, 'result');
  assert.equal(result.history.length, 1);
  assert.deepEqual(executePlan(result), result);
  assert.deepEqual(toggleAction(result, 'work'), result);
  const next = nextRound(result);
  assert.equal(next.round, 2);
  assert.deepEqual(nextRound(next), next);
});

test('empty, duplicate, unknown and over-three-action plans are rejected without settlement', () => {
  for (const ids of [[], ['study', 'study'], ['missing'], ['study', 'consult', 'rest', 'reflect']]) {
    const game = { ...start(), selectedActionIds: ids };
    assert.equal(previewPlan(game).valid, false, JSON.stringify(ids));
    assert.deepEqual(executePlan(game), game);
    assert.equal(game.history.length, 0);
  }
  const three = select(start(), ['study', 'consult', 'rest']);
  assert.deepEqual(toggleAction(three, 'talk'), three);
});

test('insufficient funds and time prevent execution, while free actions remain playable at zero funds', () => {
  const poor = { ...start(), stats: { ...start().stats, money: 0 } };
  const unaffordable = { ...poor, selectedActionIds: ['study'] };
  assert.equal(previewPlan(unaffordable).valid, false);
  assert.deepEqual(executePlan(unaffordable), unaffordable);
  for (const id of ['reflect', 'consult', 'rest']) {
    assert.equal(getActions(poor).find(action => action.id === id)?.available, true, id);
  }
  const freeResult = execute(poor, ['reflect', 'consult', 'rest']);
  assert.equal(freeResult.stats.money, 0);
  const long = { ...start(), completedActions: ['research'], stats: { ...start().stats, skill: 50 }, selectedActionIds: ['practice', 'study', 'rest'] };
  assert.ok(previewPlan(long).timeUsed > RULES.timePerRound);
  assert.equal(previewPlan(long).valid, false);
  assert.deepEqual(executePlan(long), long);
});

test('bounded states clamp at zero and one hundred, while earned funds may exceed one hundred', () => {
  const high = { ...start(), stats: { money: 150, skill: 98, support: 98, health: 98, satisfaction: 98 } };
  const raised = execute(high, ['study', 'consult', 'rest']);
  for (const key of ['skill', 'support', 'health', 'satisfaction'] as const) {
    assert.ok(raised.stats[key] >= 0 && raised.stats[key] <= 100, key);
  }
  const low = { ...start(), stats: { ...start().stats, health: 2 } };
  const worked = execute(low, ['study', 'work']);
  assert.equal(worked.stats.health, 0);
  const paid = execute(high, ['work']);
  assert.equal(paid.stats.money, 170);
});

test('requirements use the round-start snapshot, and the final action requires every key preparation', () => {
  const initial = start();
  assert.equal(getActions(initial).find(action => action.id === 'final')?.available, false);
  const apparentChain = select(initial, ['study', 'research']);
  assert.equal(getActions(apparentChain).find(action => action.id === 'practice')?.available, false);
  assert.deepEqual(toggleAction(apparentChain, 'practice'), apparentChain);
  const forged = { ...initial, selectedActionIds: ['final'] };
  assert.equal(previewPlan(forged).valid, false);
  assert.deepEqual(executePlan(forged), forged);
  for (const missing of ['research', 'practice', 'improve']) {
    const prepared = { ...initial, stats: { money: 100, skill: 100, support: 100, health: 100, satisfaction: 100 }, completedActions: ['research', 'practice', 'improve'].filter(id => id !== missing) };
    assert.equal(getActions(prepared).find(action => action.id === 'final')?.available, false, missing);
  }
});

test('one-off actions and stage tasks cannot be completed a second time, and achieved tasks stay achieved', () => {
  const first = execute(start(), ['study', 'research', 'consult']);
  const next = nextRound(first);
  assert.equal(getActions(next).find(action => action.id === 'research')?.available, false);
  assert.deepEqual(toggleAction(next, 'research'), next);
  assert.equal(new Set(first.completedTasks).size, first.completedTasks.length);
  const lower = { ...next, stats: { ...next.stats, skill: 0 } };
  const reflected = execute(lower, ['reflect']);
  for (const id of first.completedTasks) assert.ok(reflected.completedTasks.includes(id));
  assert.equal(new Set(reflected.completedTasks).size, reflected.completedTasks.length);
  const repeat = reflected.history.at(-1)!;
  for (const id of first.completedTasks) assert.equal(repeat.newTaskIds.includes(id), false);
});

test('the values choice is required once in round three, and does not apply before confirmation or twice', () => {
  let game = nextRound(execute(start(), ['reflect']));
  game = nextRound(execute(game, ['reflect']));
  assert.equal(game.round, 3);
  const withoutChoice = select(game, ['reflect']);
  assert.equal(previewPlan(withoutChoice).valid, false);
  const chosen = chooseStrategy(withoutChoice, 'care');
  assert.deepEqual(chosen.stats, game.stats);
  assert.equal(previewPlan(chosen).valid, true);
  const result = executePlan(chosen);
  assert.equal(result.stats.satisfaction, Math.min(100, game.stats.satisfaction + 10));
  assert.deepEqual(executePlan(result), result);
  const fourth = nextRound(result);
  const after = execute(fourth, ['reflect']);
  assert.equal(after.stats.satisfaction, result.stats.satisfaction);
});

test('fixed event action adjustments appear in previews and apply only once per settlement', () => {
  let game = nextRound(execute(start(), ['study', 'research', 'consult']));
  game = nextRound(execute(game, ['study', 'consult', 'rest']));
  const practice = getActions(game).find(action => action.id === 'practice')!;
  const base = DREAMS.find(dream => dream.id === 'cafe')!.actions.find(action => action.id === 'practice')!;
  assert.equal(practice.cost, base.cost + 5);
  const selected = chooseStrategy(select(game, ['practice', 'rest']), 'care');
  const before = JSON.stringify(selected);
  const preview = previewPlan(selected);
  assert.deepEqual(previewPlan(selected), preview);
  assert.equal(JSON.stringify(selected), before);
  const result = executePlan(selected);
  assert.equal(result.stats.money, game.stats.money - practice.cost);
  assert.deepEqual(executePlan(result), result);
});

test('progress is the equal-weight mean of configured stage task fractions', () => {
  const game = execute(start(), ['study', 'research', 'consult']);
  const progress = getProgress(game);
  const expected = Math.round(progress.stages.reduce((sum, stage) => sum + stage.done / stage.total, 0) / 3 * 100);
  assert.equal(progress.percent, expected);
  assert.equal(progress.completedStages, progress.stages.filter(stage => stage.done === stage.total).length);
});

test('six completed rounds always finish the game; no seventh round or unearned early ending is possible', () => {
  let game = start();
  assert.deepEqual(finishGame(game), game);
  for (let round = 1; round <= 6; round++) {
    assert.equal(game.round, round);
    game = execute(game, ['reflect'], round === 3 ? 'care' : undefined);
    if (round < 6) game = nextRound(game);
  }
  assert.equal(game.status, 'finished');
  assert.equal(game.round, 6);
  assert.equal(game.history.length, 6);
  assert.deepEqual(nextRound(game), game);
  assert.deepEqual(executePlan(game), game);
  assert.equal(isGoalComplete(game), false);
  assert.equal(getEnding(game).title, '計画の立て直し');
});

test('endings distinguish achievement, sustainability, a foundation and a plan to revisit', () => {
  const original = start();
  assert.equal(getEnding(original).title, '計画の立て直し');
  const foundation = execute(original, ['study', 'research', 'consult']);
  assert.equal(getEnding(foundation).title, '実現に向けた土台ができた');
  let completed = nextRound(foundation);
  completed = nextRound(execute(completed, ['study', 'consult', 'rest']));
  completed = nextRound(execute(completed, ['practice', 'rest'], 'care'));
  completed = nextRound(execute(completed, ['improve', 'work', 'rest']));
  completed = execute(completed, ['final', 'consult', 'rest']);
  assert.equal(getEnding(completed).title, '夢の実現');
  for (const stats of [
    { ...completed.stats, health: RULES.sustainableHealth - 1 },
    { ...completed.stats, satisfaction: RULES.sustainableSatisfaction - 1 },
  ]) {
    const lower = { ...completed, stats };
    assert.equal(getEnding(lower).title, '実現したが、見直しも必要');
    assert.equal(isGoalComplete(lower), true);
  }
});

for (const dream of ['cafe', 'manga', 'music'] as const) {
  test(`${dream}: a real, affordable six-round path completes the dream sustainably`, () => {
    let game = start(dream);
    const path = [
      ['study', 'research', 'consult'],
      ['study', 'consult', 'rest'],
      ['practice', 'rest'],
      ['improve', 'work', 'rest'],
      ['final', 'consult', 'rest'],
      ['reflect', 'rest', 'consult'],
    ];
    for (let index = 0; index < path.length; index++) {
      game = execute(game, path[index], index === 2 ? 'care' : undefined);
      assert.ok(game.stats.money >= 0);
      assert.equal(new Set(game.completedTasks).size, game.completedTasks.length);
      if (index === 4) {
        assert.equal(isGoalComplete(game), true);
        assert.equal(getProgress(game).percent, 100);
        assert.equal(finishGame(game).status, 'finished');
      }
      if (index < path.length - 1) game = nextRound(game);
    }
    assert.equal(game.status, 'finished');
    assert.equal(game.round, 6);
    assert.equal(game.history.length, 6);
    assert.equal(getProgress(game).completedStages, 3);
    assert.equal(getEnding(game).title, '夢の実現');
    assert.ok(game.stats.health >= RULES.sustainableHealth);
    assert.ok(game.stats.satisfaction >= RULES.sustainableSatisfaction);
    assert.ok(getEnding(game).feedback.length >= 2);
  });
}
