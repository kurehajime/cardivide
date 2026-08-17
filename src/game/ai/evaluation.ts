import { GameManager } from '../GameManager'
import { getOpponentId } from '../boardQueries'
import type { GameAction, PlayerId } from '../types'
import type { EvaluationBreakdown, HandPlayCandidate } from './types'

export const AI_EVALUATION_PARAMETERS = {
  victory: 20_000,
  defeat: -10_000,
  hp: 4,
  mana: 1,
  boardMaterial: 1,
  handReserve: 0.3,
  upkeepManaDiscount: 1,
  captureMarch: 1,
  capturePosition: 0.5,
} as const

const zeroBreakdown = (): EvaluationBreakdown => ({
  terminal: 0,
  hp: 0,
  mana: 0,
  boardMaterial: 0,
  handReserve: 0,
  deployableHand: 0,
  upkeepMana: 0,
  marchControl: 0,
  myAttackPotential: 0,
  opponentAttackThreat: 0,
  total: 0,
})

const terminalBreakdown = (terminal: number): EvaluationBreakdown => ({
  ...zeroBreakdown(),
  terminal,
  total: terminal,
})

const sumBreakdown = (breakdown: Omit<EvaluationBreakdown, 'total'>): number =>
  Object.values(breakdown).reduce((total, value) => total + value, 0)

const evaluateBaseForView = (
  manager: GameManager,
  aiPlayerId: PlayerId,
  includeOwnHand: boolean,
): EvaluationBreakdown => {
  const winner = GameManager.getWinner(manager)
  if (winner === aiPlayerId) {
    return terminalBreakdown(AI_EVALUATION_PARAMETERS.victory)
  }
  if (winner !== null) {
    return terminalBreakdown(AI_EVALUATION_PARAMETERS.defeat)
  }

  const opponentId = getOpponentId(aiPlayerId)
  const aiPlayer = manager.state.players[aiPlayerId]
  const opponent = manager.state.players[opponentId]
  const hp = (aiPlayer.hp - opponent.hp) * AI_EVALUATION_PARAMETERS.hp
  const mana = (aiPlayer.mana - opponent.mana) * AI_EVALUATION_PARAMETERS.mana
  const boardMaterial = manager.state.board.creatures.reduce((total, creature) => {
    const instance = manager.state.cards[creature.cardId]
    const direction = instance.ownerId === aiPlayerId ? 1 : -1
    return total + direction * instance.card.cost * AI_EVALUATION_PARAMETERS.boardMaterial
  }, 0)
  const handReserve = includeOwnHand
    ? aiPlayer.hand.reduce(
        (total, cardId) =>
          total +
          manager.state.cards[cardId].card.cost * AI_EVALUATION_PARAMETERS.handReserve,
        0,
      )
    : 0
  const upkeepMana =
    (GameManager.getKeepUpManaBonus(manager, aiPlayerId) -
      GameManager.getKeepUpManaBonus(manager, opponentId)) *
    AI_EVALUATION_PARAMETERS.upkeepManaDiscount
  const aiRestrictedPositions =
    GameManager.countReachableSummonPositions(
      manager,
      aiPlayerId,
      AI_EVALUATION_PARAMETERS.captureMarch,
      true,
    ) -
    GameManager.countReachableSummonPositions(
      manager,
      aiPlayerId,
      AI_EVALUATION_PARAMETERS.captureMarch,
    )
  const opponentRestrictedPositions =
    GameManager.countReachableSummonPositions(
      manager,
      opponentId,
      AI_EVALUATION_PARAMETERS.captureMarch,
      true,
    ) -
    GameManager.countReachableSummonPositions(
      manager,
      opponentId,
      AI_EVALUATION_PARAMETERS.captureMarch,
    )
  const marchControl =
    (opponentRestrictedPositions - aiRestrictedPositions) *
    AI_EVALUATION_PARAMETERS.capturePosition
  const values = {
    terminal: 0,
    hp,
    mana,
    boardMaterial,
    handReserve,
    deployableHand: 0,
    upkeepMana,
    marchControl,
    myAttackPotential: 0,
    opponentAttackThreat: 0,
  }

  return {
    ...values,
    total: sumBreakdown(values),
  }
}

export const evaluateBase = (
  manager: GameManager,
  aiPlayerId: PlayerId,
): EvaluationBreakdown => evaluateBaseForView(manager, aiPlayerId, true)

const evaluatePublicBase = (
  manager: GameManager,
  playerId: PlayerId,
): EvaluationBreakdown => evaluateBaseForView(manager, playerId, false)

const createBattleView = (
  manager: GameManager,
  attackerId: PlayerId,
): GameManager =>
  GameManager.from({
    ...manager.state,
    activePlayerId: attackerId,
    phase: 'battle',
    hasAttackedThisTurn: false,
    pendingCombat: null,
  })

type CombatOutcomeScores = {
  aiScore: number
  attackerScore: number
}

const getCombatOutcomeScores = (
  manager: GameManager,
  attackerId: PlayerId,
  aiPlayerId: PlayerId,
): CombatOutcomeScores[] => {
  const battleManager = createBattleView(manager, attackerId)
  return GameManager.getLegalBattleActions(battleManager).map((action) => {
    if (action.type !== 'attackGroup') {
      throw new Error('Battle action must attack a group.')
    }
    const preview = GameManager.previewCombat(
      battleManager,
      action.startIndex,
      action.endIndex,
    )
    const nextManager = GameManager.from(preview.nextState)
    const aiScore = evaluateBase(nextManager, aiPlayerId).total
    return {
      aiScore,
      attackerScore:
        attackerId === aiPlayerId
          ? aiScore
          : evaluatePublicBase(nextManager, attackerId).total,
    }
  })
}

const selectBestAttackerOutcome = (
  noAttack: CombatOutcomeScores,
  outcomes: readonly CombatOutcomeScores[],
): CombatOutcomeScores =>
  outcomes.reduce(
    (best, candidate) =>
      candidate.attackerScore > best.attackerScore ||
      (candidate.attackerScore === best.attackerScore &&
        candidate.aiScore < best.aiScore)
        ? candidate
        : best,
    noAttack,
  )

export const evaluateBattleEntry = (
  manager: GameManager,
  aiPlayerId: PlayerId,
): EvaluationBreakdown => {
  const base = evaluateBase(manager, aiPlayerId)
  if (base.terminal !== 0) {
    return base
  }

  const opponentId = getOpponentId(aiPlayerId)
  const myOutcomes = getCombatOutcomeScores(manager, aiPlayerId, aiPlayerId)
  const opponentOutcomes = getCombatOutcomeScores(manager, opponentId, aiPlayerId)
  const myBestOutcome = Math.max(
    base.total,
    ...myOutcomes.map(({ aiScore }) => aiScore),
  )
  const opponentBestOutcome = selectBestAttackerOutcome(
    {
      aiScore: base.total,
      attackerScore: evaluatePublicBase(manager, opponentId).total,
    },
    opponentOutcomes,
  )
  const myAttackPotential = Math.max(myBestOutcome - base.total, 0)
  const opponentAttackThreat = Math.max(
    base.total - opponentBestOutcome.aiScore,
    0,
  )

  return {
    ...base,
    myAttackPotential,
    opponentAttackThreat,
    total: base.total + myAttackPotential - opponentAttackThreat,
  }
}

const getHandPlayCandidates = (
  manager: GameManager,
  aiPlayerId: PlayerId,
  cardId: number,
  currentBattleScore: number,
): HandPlayCandidate[] => {
  const card = manager.state.cards[cardId].card
  if (card.kind !== 'creature') {
    return []
  }

  const bestByCost = new Map<number, HandPlayCandidate>()
  GameManager.getSummonOptions(manager, cardId)
    .filter(({ canSummon }) => canSummon)
    .forEach(({ insertIndex, effectiveCost }) => {
      const action = { type: 'summonCreature', cardId, insertIndex } satisfies GameAction
      const nextManager = GameManager.applyAction(manager, action)
      const candidate = {
        cardId,
        action,
        effectiveCost,
        value: evaluateBattleEntry(nextManager, aiPlayerId).total - currentBattleScore,
      }
      const currentBest = bestByCost.get(effectiveCost)
      if (!currentBest || candidate.value > currentBest.value) {
        bestByCost.set(effectiveCost, candidate)
      }
    })

  return [...bestByCost.values()]
}

export const getDeployableHandValue = (
  manager: GameManager,
  aiPlayerId: PlayerId,
): number => {
  if (
    manager.state.phase !== 'main' ||
    manager.state.activePlayerId !== aiPlayerId ||
    GameManager.getWinner(manager) !== null
  ) {
    return 0
  }

  const mana = manager.state.players[aiPlayerId].mana
  const currentBattleScore = evaluateBattleEntry(manager, aiPlayerId).total
  const candidatesByCard = manager.state.players[aiPlayerId].hand.map((cardId) =>
    getHandPlayCandidates(manager, aiPlayerId, cardId, currentBattleScore),
  )
  const bestValueByMana = Array<number>(mana + 1).fill(0)

  for (const candidates of candidatesByCard) {
    const previous = [...bestValueByMana]
    for (let availableMana = 0; availableMana <= mana; availableMana += 1) {
      for (const candidate of candidates) {
        if (candidate.effectiveCost <= availableMana) {
          bestValueByMana[availableMana] = Math.max(
            bestValueByMana[availableMana],
            previous[availableMana - candidate.effectiveCost] + candidate.value,
          )
        }
      }
    }
  }

  return Math.max(...bestValueByMana)
}

export const evaluateMainContinuation = (
  manager: GameManager,
  aiPlayerId: PlayerId,
): EvaluationBreakdown => {
  const battleEntry = evaluateBattleEntry(manager, aiPlayerId)
  if (battleEntry.terminal !== 0) {
    return battleEntry
  }

  const deployableHand = getDeployableHandValue(manager, aiPlayerId)
  return {
    ...battleEntry,
    deployableHand,
    total: battleEntry.total + deployableHand,
  }
}
