import type { CardInstanceId, GameAction } from '../types'

export type EvaluationBreakdown = {
  terminal: number
  hp: number
  mana: number
  boardMaterial: number
  handReserve: number
  deployableHand: number
  upkeepMana: number
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
}
