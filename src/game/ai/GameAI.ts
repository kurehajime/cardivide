import { GameManager } from '../GameManager'
import type { GameAction, PlayerId } from '../types'
import {
  evaluateBattleEntry,
  evaluateMainContinuation,
} from './evaluation'
import type { EvaluationBreakdown } from './types'

const resolveBattleOption = (
  manager: GameManager,
  action: GameAction | null,
): GameManager => {
  if (action === null) {
    return GameManager.passPhase(GameManager.passPhase(manager))
  }
  if (action.type !== 'attackGroup') {
    throw new Error('Battle option must attack a group or be null.')
  }

  return GameManager.finishCombat(GameManager.applyAction(manager, action))
}

const chooseMainAction = (
  manager: GameManager,
  aiPlayerId: PlayerId,
): GameAction => {
  const passScore = evaluateBattleEntry(manager, aiPlayerId).total
  let bestAction: GameAction | null = null
  let bestScore = passScore

  for (const action of GameManager.getLegalMainActions(manager)) {
    const nextManager = GameManager.applyAction(manager, action)
    const score = evaluateMainContinuation(nextManager, aiPlayerId).total
    if (score > bestScore) {
      bestAction = action
      bestScore = score
    }
  }

  return bestAction ?? { type: 'passPhase' }
}

const chooseBattleAction = (
  manager: GameManager,
  aiPlayerId: PlayerId,
): GameAction => {
  const noAttackScore = evaluateBattleEntry(
    resolveBattleOption(manager, null),
    aiPlayerId,
  ).total
  let bestAction: GameAction | null = null
  let bestScore = noAttackScore

  for (const action of GameManager.getLegalBattleActions(manager)) {
    const resolvedManager = resolveBattleOption(manager, action)
    if (GameManager.getWinner(resolvedManager) === aiPlayerId) {
      return action
    }
    const score = evaluateBattleEntry(resolvedManager, aiPlayerId).total
    if (score > bestScore) {
      bestAction = action
      bestScore = score
    }
  }

  return bestAction ?? { type: 'passPhase' }
}

export class GameAI {
  static evaluate(
    manager: GameManager,
    aiPlayerId: PlayerId = manager.state.activePlayerId,
  ): EvaluationBreakdown {
    return manager.state.phase === 'main'
      ? evaluateMainContinuation(manager, aiPlayerId)
      : evaluateBattleEntry(manager, aiPlayerId)
  }

  static chooseAction(manager: GameManager): GameAction | null {
    if (GameManager.getWinner(manager) !== null) {
      return null
    }
    if (manager.state.pendingCombat !== null) {
      return { type: 'finishCombat' }
    }

    const aiPlayerId = manager.state.activePlayerId
    switch (manager.state.phase) {
      case 'keepUp':
        return { type: 'resolveKeepUp' }
      case 'main':
        return chooseMainAction(manager, aiPlayerId)
      case 'battle':
        return chooseBattleAction(manager, aiPlayerId)
      case 'cleanup':
        return { type: 'passPhase' }
    }
  }
}
