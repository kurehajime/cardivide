import { GameManager } from '../GameManager'
import type { CardInstanceId, GameAction, PlayerId } from '../types'
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

const resolveMainActionForEvaluation = (
  manager: GameManager,
  action: GameAction,
): GameManager => {
  const nextManager = GameManager.applyAction(manager, action)
  return nextManager.state.pendingCombat?.endsTurnAfterResolution === false
    ? GameManager.finishCombat(nextManager)
    : nextManager
}

const chooseMainAction = (
  manager: GameManager,
  aiPlayerId: PlayerId,
  actions: readonly GameAction[],
): GameAction => {
  const passScore = evaluateBattleEntry(manager, aiPlayerId).total
  let bestAction: GameAction | null = null
  let bestScore = passScore

  for (const action of actions) {
    const nextManager = resolveMainActionForEvaluation(manager, action)
    const score = evaluateMainContinuation(nextManager, aiPlayerId).total
    if (score > bestScore) {
      bestAction = action
      bestScore = score
    }
  }

  return bestAction ?? { type: 'passPhase' }
}

const isReturnAction = (
  action: GameAction,
): action is Extract<GameAction, { type: 'activateAbility' }> =>
  action.type === 'activateAbility' && action.abilityType === 'return'

export class AiTurnActionMemory {
  private turn: number | null = null
  private playerId: PlayerId | null = null
  private readonly returnedCardIds = new Set<CardInstanceId>()

  private syncTurn(manager: GameManager): void {
    const { turn, activePlayerId } = manager.state
    if (this.turn === turn && this.playerId === activePlayerId) {
      return
    }

    this.turn = turn
    this.playerId = activePlayerId
    this.returnedCardIds.clear()
  }

  allows(manager: GameManager, action: GameAction): boolean {
    this.syncTurn(manager)
    return (
      !isReturnAction(action) ||
      !this.returnedCardIds.has(action.sourceCardId)
    )
  }

  remember(manager: GameManager, action: GameAction): void {
    this.syncTurn(manager)
    if (isReturnAction(action)) {
      this.returnedCardIds.add(action.sourceCardId)
    }
  }
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
  private readonly turnMemory = new AiTurnActionMemory()

  private getMainActions(manager: GameManager): GameAction[] {
    return GameManager.getLegalMainActions(manager).filter(
      (action) => this.turnMemory.allows(manager, action),
    )
  }

  static evaluate(
    manager: GameManager,
    aiPlayerId: PlayerId = manager.state.activePlayerId,
  ): EvaluationBreakdown {
    return manager.state.phase === 'main'
      ? evaluateMainContinuation(manager, aiPlayerId)
      : evaluateBattleEntry(manager, aiPlayerId)
  }

  chooseAction(manager: GameManager): GameAction | null {
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
      case 'main': {
        const action = chooseMainAction(
          manager,
          aiPlayerId,
          this.getMainActions(manager),
        )
        this.turnMemory.remember(manager, action)
        return action
      }
      case 'battle':
        return chooseBattleAction(manager, aiPlayerId)
      case 'cleanup':
        return { type: 'passPhase' }
    }
  }
}
