import { DREAMS, INITIAL_STATS, RULES, STAT_LABELS } from './data'
import type { DreamId, EffectiveAction, Game, PlanPreview, Requirements, Stats } from './types'

const STAT_KEYS: (keyof Stats)[] = ['money', 'skill', 'support', 'health', 'satisfaction']

export function getDream(game: Pick<Game, 'dreamId'>) {
  return DREAMS.find((dream) => dream.id === game.dreamId) ?? DREAMS[0]
}

export function getEvent(game: Game) {
  return getDream(game).events[Math.max(0, Math.min(RULES.rounds - 1, game.round - 1))]
}

export function createGame(groupName: string, players: 5 | 6, dreamId: DreamId): Game {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `game-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    groupName: groupName.trim().slice(0, 60) || 'ななしのサポーターズ',
    players,
    dreamId,
    round: 1,
    status: 'planning',
    stats: { ...INITIAL_STATS },
    selectedActionIds: [],
    completedActions: [],
    completedTasks: [],
    history: [],
    reflections: ['', '', '', ''],
  }
}

function requirementReasons(game: Game, requirements?: Requirements): string[] {
  if (!requirements) return []
  const reasons: string[] = []
  for (const stat of STAT_KEYS) {
    const minimum = requirements.minStats?.[stat]
    if (minimum !== undefined && game.stats[stat] < minimum) {
      reasons.push(`ラウンド開始時の${STAT_LABELS[stat]}${minimum}以上が必要です（現在${game.stats[stat]}）。`)
    }
  }
  for (const actionId of requirements.actions ?? []) {
    if (!game.completedActions.includes(actionId)) {
      const action = getDream(game).actions.find((candidate) => candidate.id === actionId)
      reasons.push(`前のラウンドまでに「${action?.label ?? actionId}」を終える必要があります。`)
    }
  }
  return reasons
}

/** Events modify only this round's action values; they never mutate a game on display. */
export function getActions(game: Game): EffectiveAction[] {
  const event = getEvent(game)
  return getDream(game).actions.map((action) => {
    const effective = { ...action, effects: { ...action.effects } }
    for (const adjustment of event.adjustments.filter((entry) => entry.actionId === action.id)) {
      effective.time += adjustment.time ?? 0
      effective.cost += adjustment.cost ?? 0
      for (const stat of STAT_KEYS) {
        if (adjustment.effects?.[stat] !== undefined) {
          effective.effects[stat] = (effective.effects[stat] ?? 0) + adjustment.effects[stat]!
        }
      }
    }
    effective.time = Math.max(0, effective.time)
    const reasons = requirementReasons(game, action.requirements)
    if (action.once && game.completedActions.includes(action.id)) reasons.unshift('この準備は完了しています。もう一度行う必要はありません。')
    if (game.status !== 'planning') reasons.push('このラウンドの計画は実行済みです。')
    return { ...effective, available: reasons.length === 0, reasons }
  })
}

export function toggleAction(game: Game, actionId: string): Game {
  if (game.status !== 'planning') return game
  if (game.selectedActionIds.includes(actionId)) {
    return { ...game, selectedActionIds: game.selectedActionIds.filter((id) => id !== actionId) }
  }
  const action = getActions(game).find((candidate) => candidate.id === actionId)
  if (!action?.available || game.selectedActionIds.length >= RULES.maxActions) return game
  return { ...game, selectedActionIds: [...game.selectedActionIds, actionId] }
}

export function chooseStrategy(game: Game, strategyId: string): Game {
  if (game.status !== 'planning' || game.round !== RULES.choiceRound) return game
  if (!getDream(game).strategies.some((strategy) => strategy.id === strategyId)) return game
  return { ...game, choiceId: strategyId }
}

function clampStats(stats: Stats): Stats {
  return {
    money: stats.money,
    skill: Math.max(0, Math.min(100, stats.skill)),
    support: Math.max(0, Math.min(100, stats.support)),
    health: Math.max(0, Math.min(100, stats.health)),
    satisfaction: Math.max(0, Math.min(100, stats.satisfaction)),
  }
}

export function previewPlan(game: Game): PlanPreview {
  const allActions = getActions(game)
  const actions = game.selectedActionIds.flatMap((id) => {
    const action = allActions.find((candidate) => candidate.id === id)
    return action ? [action] : []
  })
  const strategy = game.round === RULES.choiceRound
    ? getDream(game).strategies.find((candidate) => candidate.id === game.choiceId)
    : undefined
  const reasons: string[] = []
  if (game.status !== 'planning') reasons.push('このラウンドは実行済みです。')
  if (game.round < 1 || game.round > RULES.rounds) reasons.push('実行できるラウンドではありません。')
  if (game.history.some((record) => record.round === game.round)) reasons.push('このラウンドはすでに記録されています。')
  if (!actions.length) reasons.push('行動を1つ以上選んでください。')
  if (game.selectedActionIds.length > RULES.maxActions) reasons.push(`行動は${RULES.maxActions}つまでです。`)
  if (actions.length !== game.selectedActionIds.length) reasons.push('選択した行動が見つかりません。')
  if (new Set(game.selectedActionIds).size !== game.selectedActionIds.length) reasons.push('同じ行動は1ラウンドに1回までです。')
  for (const action of actions) if (!action.available) reasons.push(...action.reasons)
  if (game.round === RULES.choiceRound && !strategy) reasons.push('本人と相談して、大切にする方針を1つ選んでください。')

  const timeUsed = actions.reduce((total, action) => total + action.time, strategy?.time ?? 0)
  let moneyCost = actions.reduce((total, action) => total + action.cost, strategy?.cost ?? 0)
  const stats = { ...game.stats }
  for (const entry of [...actions, ...(strategy ? [strategy] : [])]) {
    for (const stat of STAT_KEYS) stats[stat] += entry.effects[stat] ?? 0
  }
  moneyCost -= stats.money - game.stats.money
  stats.money = game.stats.money - moneyCost
  if (timeUsed > RULES.timePerRound) reasons.push(`時間が${timeUsed - RULES.timePerRound}点足りません（使用${timeUsed}／上限${RULES.timePerRound}）。`)
  if (stats.money < 0) reasons.push(`資金が${-stats.money}点足りません。支出を減らすか、収入を得る計画にしましょう。`)
  return { stats: clampStats(stats), timeUsed, moneyCost, valid: reasons.length === 0, reasons: [...new Set(reasons)], actions, strategy }
}

function newlyCompletedTasks(game: Game): string[] {
  return getDream(game).stages.flatMap((stage) => stage.tasks)
    .filter((task) => !game.completedTasks.includes(task.id) && requirementReasons(game, task.requirements).length === 0)
    .map((task) => task.id)
}

function reaction(game: Game, actionIds: string[], achievedGoal: boolean): string {
  if (achievedGoal) return 'みんなでここまで形にできて、うれしいです。これからも無理なく続ける方法を考えたいです。'
  if (game.stats.health < RULES.sustainableHealth) return '支えてくれてありがとう。少し疲れを感じているので、次は休む時間も一緒に考えたいです。'
  if (game.stats.satisfaction < RULES.sustainableSatisfaction) return '進め方について、私の気持ちももう一度聞いてもらえるとうれしいです。'
  if (actionIds.includes('rest')) return '休む時間も大切にしてもらえて、安心しました。自分のペースで続けていきたいです。'
  if (actionIds.includes('practice')) return '実際に試したことで、次に直したいところが見えてきました。'
  if (actionIds.length === 1 && actionIds[0] === 'reflect') return 'いったん立ち止まって、これから何を大切にするか整理できました。'
  return '一緒に考えてくれてありがとう。できたことを確かめて、次の一歩を選びたいです。'
}

export function executePlan(game: Game): Game {
  const preview = previewPlan(game)
  if (!preview.valid) return game
  const completedActions = [...new Set([...game.completedActions, ...game.selectedActionIds])]
  const provisional = { ...game, stats: { ...preview.stats }, completedActions }
  const newTaskIds = newlyCompletedTasks(provisional)
  const completedTasks = [...game.completedTasks, ...newTaskIds]
  const updated: Game = {
    ...provisional,
    completedTasks,
    status: game.round === RULES.rounds ? 'finished' : 'result',
    history: [...game.history, {
      round: game.round,
      actionIds: [...game.selectedActionIds],
      actionLabels: preview.actions.map((action) => action.label),
      choiceId: preview.strategy?.id,
      choiceLabel: preview.strategy?.title,
      eventTitle: getEvent(game).title,
      before: { ...game.stats },
      after: { ...preview.stats },
      newTaskIds,
      reaction: reaction(provisional, game.selectedActionIds, completedActions.includes('final')),
    }],
  }
  return updated
}

export function nextRound(game: Game): Game {
  if (game.status !== 'result') return game
  if (game.round >= RULES.rounds) return { ...game, status: 'finished' }
  return { ...game, round: game.round + 1, status: 'planning', selectedActionIds: [] }
}

export function isGoalComplete(game: Game): boolean {
  return game.completedActions.includes('final')
}

export function finishGame(game: Game): Game {
  if (game.status !== 'result' || !isGoalComplete(game)) return game
  return { ...game, status: 'finished' }
}

export function getProgress(game: Game) {
  const stages = getDream(game).stages.map((stage) => {
    const tasks = stage.tasks.map((task) => ({ ...task, completed: game.completedTasks.includes(task.id) }))
    const done = tasks.filter((task) => task.completed).length
    return { ...stage, tasks, done, total: tasks.length, completed: done === tasks.length }
  })
  const fraction = stages.reduce((total, stage) => total + (stage.total ? stage.done / stage.total : 0), 0) / stages.length
  return { percent: Math.round(fraction * 100), completedStages: stages.filter((stage) => stage.completed).length, stages }
}

export function getEnding(game: Game) {
  const progress = getProgress(game)
  const achieved = isGoalComplete(game)
  const sustainable = game.stats.health >= RULES.sustainableHealth && game.stats.satisfaction >= RULES.sustainableSatisfaction
  let title: string
  let description: string
  if (achieved && sustainable) {
    title = '夢の実現'
    description = '本人が大切にすることと、続けられる心身の状態を守りながら、夢を形にできました。'
  } else if (achieved) {
    title = '実現したが、見直しも必要'
    description = '夢を形にできました。これから続けていくために、本人の気持ちや休む時間も話し合いましょう。'
  } else if (progress.completedStages >= 1 || progress.percent >= 33) {
    title = '実現に向けた土台ができた'
    description = 'まだ途中ですが、積み重ねた準備は次の一歩につながります。残っている条件を一緒に確かめましょう。'
  } else {
    title = '計画の立て直し'
    description = '今回わかったことを手がかりに、支援の順番や時間の使い方を見直してみましょう。夢への道は、ここで終わりではありません。'
  }
  const count = (actionId: string) => game.history.filter((record) => record.actionIds.includes(actionId)).length
  const feedback: string[] = []
  if (count('study')) feedback.push(`学習・練習を${count('study')}回行いました。現在のスキルは${game.stats.skill}です。`)
  else feedback.push(`学習・練習は今回選びませんでした。現在のスキルは${game.stats.skill}です。`)
  if (count('consult')) feedback.push(`人に相談する機会を${count('consult')}回つくりました。完了した段階は${progress.completedStages}／3です。`)
  else feedback.push(`人に相談する機会はありませんでした。完了した段階は${progress.completedStages}／3です。`)
  if (game.stats.health < RULES.sustainableHealth) feedback.push(`心身の状態は${game.stats.health}です。休息を確保できる進め方を、本人と相談してみましょう。`)
  else if (game.stats.satisfaction < RULES.sustainableSatisfaction) feedback.push(`本人の満足度は${game.stats.satisfaction}です。大切にしたいことを聞き直す時間も、支援の一つです。`)
  else feedback.push(`心身の状態${game.stats.health}・本人の満足度${game.stats.satisfaction}で、継続の目安（${RULES.sustainableHealth}・${RULES.sustainableSatisfaction}以上）を満たしています。`)
  return { title, description, feedback }
}
