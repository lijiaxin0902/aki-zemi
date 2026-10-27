export type DreamId = 'cafe' | 'manga' | 'music'

export interface Stats {
  money: number
  skill: number
  support: number
  health: number
  satisfaction: number
}

export interface Requirements {
  minStats?: Partial<Stats>
  actions?: string[]
}

export interface Action {
  id: string
  label: string
  description: string
  category: 'common' | 'dream'
  time: number
  cost: number
  effects: Partial<Stats>
  requirements?: Requirements
  once?: boolean
}

export interface EffectiveAction extends Action {
  available: boolean
  reasons: string[]
}

export interface Task {
  id: string
  label: string
  requirements: Requirements
}

export interface Stage {
  id: string
  title: string
  tasks: Task[]
}

export interface Strategy {
  id: string
  title: string
  description: string
  attitude: string
  time: number
  cost: number
  effects: Partial<Stats>
}

export interface ActionAdjustment {
  actionId: string
  time?: number
  cost?: number
  effects?: Partial<Stats>
}

export interface RoundEvent {
  title: string
  description: string
  adjustments: ActionAdjustment[]
}

export interface Dream {
  id: DreamId
  title: string
  icon: string
  character: {
    name: string
    background: string
    motivation: string
    strength: string
    difficulty: string
    values: string
    refusal: string
    quote: string
  }
  stages: Stage[]
  actions: Action[]
  events: RoundEvent[]
  strategies: Strategy[]
}

export interface RoundRecord {
  round: number
  actionIds: string[]
  actionLabels: string[]
  choiceId?: string
  choiceLabel?: string
  eventTitle: string
  before: Stats
  after: Stats
  newTaskIds: string[]
  reaction: string
}

export interface Game {
  id: string
  groupName: string
  players: 5 | 6
  dreamId: DreamId
  round: number
  status: 'planning' | 'result' | 'finished'
  stats: Stats
  selectedActionIds: string[]
  choiceId?: string
  completedActions: string[]
  completedTasks: string[]
  history: RoundRecord[]
  reflections: string[]
  roleAssignments?: Record<string, string>
}

export interface PlanPreview {
  stats: Stats
  timeUsed: number
  moneyCost: number
  valid: boolean
  reasons: string[]
  actions: EffectiveAction[]
  strategy?: Strategy
}
