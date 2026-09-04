import { GameManager } from '../GameManager'
import { getOpponentId } from '../boardQueries'
import type { CardInstanceId, GameAction, GameState, PlayerId } from '../types'
import type { EvaluationBreakdown, HandPlayCandidate } from './types'
import {
  areScoresEquivalent,
  isMeaningfullyGreater,
  isMeaningfullyLess,
} from './scoreComparison'

const NO_IGNORED_HAND_CARDS: ReadonlySet<CardInstanceId> = new Set()

export const AI_EVALUATION_PARAMETERS = {
  victory: 20_000,
  defeat: -10_000,
  hp: 4,
  mana: 1,
  boardMaterial: 1,
  creatureHandReserve: 0.3,
  spellHandReserve: 2,
  lifeDropletHoldMultiplier: 0.5,
  upkeepManaMultiplier: 1.2,
  captureMarch: 1,
  capturePosition: 0.5,
  futureAttackPotentialMultiplier: 0.75,
  plunderFutureDeployableHand: 0.3,
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

export const evaluateBase = (
  manager: GameManager,
  aiPlayerId: PlayerId,
  ignoredHandCardIds: ReadonlySet<CardInstanceId> = NO_IGNORED_HAND_CARDS,
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
  const mana =
    (GameManager.getManaRetainedAfterTurnEnd(manager, aiPlayerId) -
      GameManager.getManaRetainedAfterTurnEnd(manager, opponentId)) *
    AI_EVALUATION_PARAMETERS.mana
  const boardMaterial = manager.state.board.creatures.reduce((total, creature) => {
    const instance = manager.state.cards[creature.cardId]
    const direction = instance.ownerId === aiPlayerId ? 1 : -1
    return total + direction * instance.card.cost * AI_EVALUATION_PARAMETERS.boardMaterial
  }, 0)
  const evaluatedHand = aiPlayer.hand.filter(
    (cardId) => !ignoredHandCardIds.has(cardId),
  )
  const baseHandReserve = evaluatedHand.reduce(
    (total, cardId) => {
      const card = manager.state.cards[cardId].card
      return (
        total +
        (card.kind === 'spell'
          ? AI_EVALUATION_PARAMETERS.spellHandReserve
          : card.cost * AI_EVALUATION_PARAMETERS.creatureHandReserve)
      )
    },
    0,
  )
  const hasLifeDroplet = evaluatedHand.some((cardId) => {
    const card = manager.state.cards[cardId].card
    return card.kind === 'spell' && card.effect.type === 'lifeDroplet'
  })
  const lifeDropletHoldValue = hasLifeDroplet
    ? aiPlayer.discard.reduce((total, cardId) => {
        const card = manager.state.cards[cardId].card
        return total + Number(card.kind === 'creature' && card.color === 'blue')
      }, 0) *
      AI_EVALUATION_PARAMETERS.hp *
      AI_EVALUATION_PARAMETERS.lifeDropletHoldMultiplier
    : 0
  const handReserve = baseHandReserve + lifeDropletHoldValue
  const upkeepMana =
    (GameManager.getKeepUpManaBonus(manager, aiPlayerId) -
      GameManager.getKeepUpManaBonus(manager, opponentId)) *
    AI_EVALUATION_PARAMETERS.upkeepManaMultiplier
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

const getOpponentPublicScore = (evaluation: EvaluationBreakdown): number => {
  if (evaluation.terminal === AI_EVALUATION_PARAMETERS.victory) {
    return AI_EVALUATION_PARAMETERS.defeat
  }
  if (evaluation.terminal === AI_EVALUATION_PARAMETERS.defeat) {
    return AI_EVALUATION_PARAMETERS.victory
  }

  // Every non-hand base component is symmetric between the two players.
  return -(evaluation.total - evaluation.handReserve)
}

const getBestAffordableCreatureCost = (
  manager: GameManager,
  aiPlayerId: PlayerId,
  mana: number,
): number => {
  const creatureCosts = manager.state.players[aiPlayerId].hand.flatMap((cardId) => {
    const card = manager.state.cards[cardId].card
    return card.kind === 'creature' ? [card.cost] : []
  })
  let bestCost = 0

  for (let mask = 1; mask < 1 << creatureCosts.length; mask += 1) {
    let totalCost = 0
    for (let index = 0; index < creatureCosts.length; index += 1) {
      if ((mask & (1 << index)) !== 0) {
        totalCost += creatureCosts[index]
      }
    }
    if (totalCost <= mana) {
      bestCost = Math.max(bestCost, totalCost)
    }
  }

  return bestCost
}

export const getPlunderFutureDeployableHandValue = (
  manager: GameManager,
  aiPlayerId: PlayerId,
  manaGain: number,
  retainedManaAfterCombat: number,
): number => {
  if (manaGain <= 0 || GameManager.getWinner(manager) !== null) {
    return 0
  }

  const keepUpMana = 2 + GameManager.getKeepUpManaBonus(manager, aiPlayerId)
  const manaAfterGain = retainedManaAfterCombat + keepUpMana
  const manaWithoutGain = Math.max(0, retainedManaAfterCombat - manaGain) + keepUpMana
  return (
    getBestAffordableCreatureCost(manager, aiPlayerId, manaAfterGain) -
    getBestAffordableCreatureCost(manager, aiPlayerId, manaWithoutGain)
  ) * AI_EVALUATION_PARAMETERS.plunderFutureDeployableHand
}

const projectActivePlayerInstallments = (manager: GameManager): GameState => {
  const playerId = manager.state.activePlayerId
  const resolution = GameManager.getEndTurnInstallmentResolution(manager, playerId)
  if (
    resolution.mana === manager.state.players[playerId].mana &&
    resolution.destroyedCardIds.length === 0
  ) {
    return manager.state
  }

  const destroyedCardIds = new Set(resolution.destroyedCardIds)
  const player = manager.state.players[playerId]
  return {
    ...manager.state,
    players: {
      ...manager.state.players,
      [playerId]: {
        ...player,
        mana: resolution.mana,
        discard: [...player.discard, ...resolution.destroyedCardIds],
      },
    },
    board: {
      creatures: manager.state.board.creatures.filter(
        ({ cardId }) => !destroyedCardIds.has(cardId),
      ),
    },
  }
}

const createBattleView = (
  manager: GameManager,
  attackerId: PlayerId,
): GameManager => {
  const state =
    attackerId === manager.state.activePlayerId
      ? manager.state
      : projectActivePlayerInstallments(manager)
  return GameManager.from({
    ...state,
    activePlayerId: attackerId,
    phase: 'battle',
    hasAttackedThisTurn: false,
    pendingCombat: null,
  })
}

type CombatOutcomeScores = {
  aiScore: number
  attackerScore: number
}

const getNoAttackOutcomeScores = (
  manager: GameManager,
  attackerId: PlayerId,
  aiPlayerId: PlayerId,
  ignoredHandCardIds: ReadonlySet<CardInstanceId>,
  baseEvaluation: EvaluationBreakdown,
): CombatOutcomeScores => {
  const projectedState =
    attackerId === manager.state.activePlayerId
      ? manager.state
      : projectActivePlayerInstallments(manager)
  const evaluation =
    projectedState === manager.state
      ? baseEvaluation
      : evaluateBase(
          GameManager.from(projectedState),
          aiPlayerId,
          ignoredHandCardIds,
        )
  return {
    aiScore: evaluation.total,
    attackerScore:
      attackerId === aiPlayerId
        ? evaluation.total
        : getOpponentPublicScore(evaluation),
  }
}

const getCombatOutcomeScores = (
  manager: GameManager,
  attackerId: PlayerId,
  aiPlayerId: PlayerId,
  ignoredHandCardIds: ReadonlySet<CardInstanceId>,
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
    const aiEvaluation = evaluateBase(nextManager, aiPlayerId, ignoredHandCardIds)
    const plunderFutureDeployableHand =
      attackerId === aiPlayerId
        ? getPlunderFutureDeployableHandValue(
            nextManager,
            aiPlayerId,
            preview.attackerManaGain,
            GameManager.getManaRetainedAfterTurnEnd(nextManager, aiPlayerId),
          )
        : 0
    const aiScore = aiEvaluation.total + plunderFutureDeployableHand
    return {
      aiScore,
      attackerScore:
        attackerId === aiPlayerId
          ? aiScore
          : getOpponentPublicScore(aiEvaluation),
    }
  })
}

const selectBestAttackerOutcome = (
  noAttack: CombatOutcomeScores,
  outcomes: readonly CombatOutcomeScores[],
): CombatOutcomeScores =>
  outcomes.reduce(
    (best, candidate) =>
      isMeaningfullyGreater(candidate.attackerScore, best.attackerScore) ||
      (areScoresEquivalent(candidate.attackerScore, best.attackerScore) &&
        isMeaningfullyLess(candidate.aiScore, best.aiScore))
        ? candidate
        : best,
    noAttack,
  )

export const evaluateBattleEntry = (
  manager: GameManager,
  aiPlayerId: PlayerId,
  ignoredHandCardIds: ReadonlySet<CardInstanceId> = NO_IGNORED_HAND_CARDS,
): EvaluationBreakdown => {
  const base = evaluateBase(manager, aiPlayerId, ignoredHandCardIds)
  if (base.terminal !== 0) {
    return base
  }

  const opponentId = getOpponentId(aiPlayerId)
  const myOutcomes = getCombatOutcomeScores(
    manager,
    aiPlayerId,
    aiPlayerId,
    ignoredHandCardIds,
  )
  const opponentOutcomes = getCombatOutcomeScores(
    manager,
    opponentId,
    aiPlayerId,
    ignoredHandCardIds,
  )
  const myNoAttackOutcome = getNoAttackOutcomeScores(
    manager,
    aiPlayerId,
    aiPlayerId,
    ignoredHandCardIds,
    base,
  )
  const opponentNoAttackOutcome = getNoAttackOutcomeScores(
    manager,
    opponentId,
    aiPlayerId,
    ignoredHandCardIds,
    base,
  )
  const myBestOutcome = Math.max(
    myNoAttackOutcome.aiScore,
    ...myOutcomes.map(({ aiScore }) => aiScore),
  )
  const opponentBestOutcome = selectBestAttackerOutcome(
    opponentNoAttackOutcome,
    opponentOutcomes,
  )
  const myAttackPotentialMultiplier =
    manager.state.activePlayerId === aiPlayerId
      ? 1
      : AI_EVALUATION_PARAMETERS.futureAttackPotentialMultiplier
  const myAttackPotential =
    Math.max(myBestOutcome - myNoAttackOutcome.aiScore, 0) *
    myAttackPotentialMultiplier
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

const TERMINAL_SCORE_EPSILON = 1e-6

const getBattleEntryBaseTotal = (evaluation: EvaluationBreakdown): number =>
  evaluation.total - evaluation.myAttackPotential + evaluation.opponentAttackThreat

const isPredictedVictory = (evaluation: EvaluationBreakdown): boolean =>
  Math.abs(
    getBattleEntryBaseTotal(evaluation) +
      evaluation.myAttackPotential -
      AI_EVALUATION_PARAMETERS.victory,
  ) < TERMINAL_SCORE_EPSILON

const isPredictedDefeat = (evaluation: EvaluationBreakdown): boolean =>
  Math.abs(
    getBattleEntryBaseTotal(evaluation) -
      evaluation.opponentAttackThreat -
      AI_EVALUATION_PARAMETERS.defeat,
  ) < TERMINAL_SCORE_EPSILON

const hasTerminalSwing = (
  current: EvaluationBreakdown,
  next: EvaluationBreakdown,
): boolean =>
  (!isPredictedVictory(current) && isPredictedVictory(next)) ||
  (isPredictedDefeat(current) && !isPredictedDefeat(next))

const getHandPlayCandidates = (
  manager: GameManager,
  aiPlayerId: PlayerId,
  cardId: CardInstanceId,
  currentBattleEvaluation: EvaluationBreakdown,
  ignoredHandCardIds: ReadonlySet<CardInstanceId>,
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
      const nextBattleEvaluation = evaluateBattleEntry(
        nextManager,
        aiPlayerId,
        ignoredHandCardIds,
      )
      const candidate = {
        cardId,
        action,
        effectiveCost,
        value: nextBattleEvaluation.total - currentBattleEvaluation.total,
        baseValue:
          getBattleEntryBaseTotal(nextBattleEvaluation) -
          getBattleEntryBaseTotal(currentBattleEvaluation),
        terminalSwing: hasTerminalSwing(
          currentBattleEvaluation,
          nextBattleEvaluation,
        ),
      }
      const currentBest = bestByCost.get(effectiveCost)
      if (!currentBest || isMeaningfullyGreater(candidate.value, currentBest.value)) {
        bestByCost.set(effectiveCost, candidate)
      }
    })

  return [...bestByCost.values()]
}

const canEvaluateDeployableHand = (
  manager: GameManager,
  aiPlayerId: PlayerId,
): boolean =>
  manager.state.phase === 'main' &&
  manager.state.activePlayerId === aiPlayerId &&
  GameManager.getWinner(manager) === null

const getDeployableHandValueFromBattleEvaluation = (
  manager: GameManager,
  aiPlayerId: PlayerId,
  currentBattleEvaluation: EvaluationBreakdown,
  ignoredHandCardIds: ReadonlySet<CardInstanceId>,
): number => {
  if (!canEvaluateDeployableHand(manager, aiPlayerId)) {
    return 0
  }

  const mana = manager.state.players[aiPlayerId].mana
  const candidatesByCard = manager.state.players[aiPlayerId].hand
    .filter((cardId) => !ignoredHandCardIds.has(cardId))
    .map((cardId) =>
      getHandPlayCandidates(
        manager,
        aiPlayerId,
        cardId,
        currentBattleEvaluation,
        ignoredHandCardIds,
      ),
    )
  const bestWithoutTerminalByMana = Array<number>(mana + 1).fill(0)
  const bestWithTerminalByMana = Array<number>(mana + 1).fill(
    Number.NEGATIVE_INFINITY,
  )

  for (const candidates of candidatesByCard) {
    const previousWithoutTerminal = [...bestWithoutTerminalByMana]
    const previousWithTerminal = [...bestWithTerminalByMana]
    for (let availableMana = 0; availableMana <= mana; availableMana += 1) {
      for (const candidate of candidates) {
        if (candidate.effectiveCost <= availableMana) {
          const remainingMana = availableMana - candidate.effectiveCost
          if (candidate.terminalSwing) {
            bestWithoutTerminalByMana[availableMana] = Math.max(
              bestWithoutTerminalByMana[availableMana],
              previousWithoutTerminal[remainingMana] + candidate.baseValue,
            )
            bestWithTerminalByMana[availableMana] = Math.max(
              bestWithTerminalByMana[availableMana],
              previousWithoutTerminal[remainingMana] + candidate.value,
              previousWithTerminal[remainingMana] + candidate.baseValue,
            )
          } else {
            bestWithoutTerminalByMana[availableMana] = Math.max(
              bestWithoutTerminalByMana[availableMana],
              previousWithoutTerminal[remainingMana] + candidate.value,
            )
            bestWithTerminalByMana[availableMana] = Math.max(
              bestWithTerminalByMana[availableMana],
              previousWithTerminal[remainingMana] + candidate.value,
            )
          }
        }
      }
    }
  }

  return Math.max(
    ...bestWithoutTerminalByMana,
    ...bestWithTerminalByMana,
  )
}

export const getDeployableHandValue = (
  manager: GameManager,
  aiPlayerId: PlayerId,
  ignoredHandCardIds: ReadonlySet<CardInstanceId> = NO_IGNORED_HAND_CARDS,
): number => {
  if (!canEvaluateDeployableHand(manager, aiPlayerId)) {
    return 0
  }

  return getDeployableHandValueFromBattleEvaluation(
    manager,
    aiPlayerId,
    evaluateBattleEntry(manager, aiPlayerId, ignoredHandCardIds),
    ignoredHandCardIds,
  )
}

export const evaluateMainContinuation = (
  manager: GameManager,
  aiPlayerId: PlayerId,
  ignoredHandCardIds: ReadonlySet<CardInstanceId> = NO_IGNORED_HAND_CARDS,
): EvaluationBreakdown => {
  const battleEntry = evaluateBattleEntry(manager, aiPlayerId, ignoredHandCardIds)
  if (battleEntry.terminal !== 0) {
    return battleEntry
  }

  const deployableHand = getDeployableHandValueFromBattleEvaluation(
    manager,
    aiPlayerId,
    battleEntry,
    ignoredHandCardIds,
  )
  return {
    ...battleEntry,
    deployableHand,
    total: battleEntry.total + deployableHand,
  }
}

export const evaluateCoherentMainPlan = (
  manager: GameManager,
  aiPlayerId: PlayerId,
  ignoredHandCardIds: ReadonlySet<CardInstanceId> = NO_IGNORED_HAND_CARDS,
): EvaluationBreakdown => {
  let currentManager = manager
  let bestEvaluation = evaluateBattleEntry(
    currentManager,
    aiPlayerId,
    ignoredHandCardIds,
  )

  while (true) {
    let nextManager: GameManager | null = null
    let nextEvaluation: EvaluationBreakdown | null = null

    for (const action of GameManager.getLegalMainActions(currentManager)) {
      if (
        action.type !== 'summonCreature' ||
        ignoredHandCardIds.has(action.cardId)
      ) {
        continue
      }

      const candidateManager = GameManager.applyAction(currentManager, action)
      const candidateEvaluation = evaluateBattleEntry(
        candidateManager,
        aiPlayerId,
        ignoredHandCardIds,
      )
      if (
        nextEvaluation === null ||
        isMeaningfullyGreater(candidateEvaluation.total, nextEvaluation.total)
      ) {
        nextManager = candidateManager
        nextEvaluation = candidateEvaluation
      }
    }

    if (nextManager === null || nextEvaluation === null) {
      return bestEvaluation
    }

    currentManager = nextManager
    if (isMeaningfullyGreater(nextEvaluation.total, bestEvaluation.total)) {
      bestEvaluation = nextEvaluation
    }
  }
}
