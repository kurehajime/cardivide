import type { CardInstanceId, GameAction } from '../types'

export type AiDifficulty = 'easy' | 'normal' | 'hard'

export type GameAIOptions = {
  difficulty?: AiDifficulty
  random?: () => number
}

export type EvaluationBreakdown = {
  terminal: number
  hp: number
  mana: number
  boardMaterial: number
  handReserve: number
  deployableHand: number
  upkeepMana: number
  upkeepDamage: number
  marchControl: number
  myAttackPotential: number
  opponentAttackThreat: number
  total: number
}

export type HandPlayCandidate = {
  cardId: CardInstanceId
  action: GameAction
  effectiveCost: number
  value: number
  baseValue: number
  terminalSwing: boolean
}
