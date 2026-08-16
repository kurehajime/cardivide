import { createDeck, STANDARD_DECK_LIST } from './decks'
import {
  CreatureRules,
  getGreenFormationKeepUpMana,
} from './CreatureRules'
import {
  collectBoardGroups,
  getCrossedIndexes,
  getCreatureOwnerAt,
  getOpponentId,
  isAdjacentInsertToAnchor,
  isForwardInsertFromAnchor,
  isWholeGroup,
} from './boardQueries'
import { PLAYER_IDS } from './types'
import type {
  ActivatedAbilityOption,
  ActivatedAbilityType,
  CardInstance,
  CardInstanceId,
  CombatPreview,
  CreatureCard,
  CreatureInstance,
  CreatureStatModifier,
  EffectiveBoardGroup,
  EffectiveCreatureStats,
  GameAction,
  GameDeckLists,
  GameState,
  Phase,
  PlayerId,
  PlayerState,
  SummonOption,
} from './types'

const PHASE_ORDER = ['main', 'battle', 'cleanup'] satisfies Phase[]

const PLAYER_BARRIER = 2
const MAX_HAND_SIZE = 5
const SECOND_PLAYER_STARTING_MANA = 1
const DEFAULT_DECK_LISTS: GameDeckLists = {
  playerA: STANDARD_DECK_LIST,
  playerB: STANDARD_DECK_LIST,
}

const getWinnerFromState = (state: GameState): PlayerId | null => {
  if (state.players.playerA.hp <= 0) {
    return 'playerB'
  }
  if (state.players.playerB.hp <= 0) {
    return 'playerA'
  }
  return null
}

const assertGameInProgress = (state: GameState): void => {
  if (getWinnerFromState(state) !== null) {
    throw new Error('The game is already over.')
  }
}

const shuffleCardIds = (
  cardIds: CardInstanceId[],
  random: () => number,
): CardInstanceId[] => {
  const shuffled = [...cardIds]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }

  return shuffled
}

const createPlayer = (
  id: PlayerId,
  name: string,
  deck: CardInstanceId[],
  startingMana = 0,
): PlayerState => ({
  id,
  name,
  hp: 20,
  mana: startingMana,
  deck,
  hand: [],
  discard: [],
  formation: null,
})

const clonePlayer = (player: PlayerState): PlayerState => ({
  ...player,
  deck: [...player.deck],
  hand: [...player.hand],
  discard: [...player.discard],
})

const cloneGameState = (state: GameState): GameState => ({
  ...state,
  cards: Object.fromEntries(
    Object.entries(state.cards).map(([id, instance]) => [id, { ...instance }]),
  ) as GameState['cards'],
  players: {
    playerA: clonePlayer(state.players.playerA),
    playerB: clonePlayer(state.players.playerB),
  },
  board: {
    creatures: state.board.creatures.map((creature) => ({ ...creature })),
  },
  pendingCombat: state.pendingCombat
    ? {
        ...state.pendingCombat,
        damageMarkers: state.pendingCombat.damageMarkers.map((marker) => ({ ...marker })),
        destroyedCardIds: [...state.pendingCombat.destroyedCardIds],
      }
    : null,
})

const createInitialState = (
  random: () => number,
  deckLists: GameDeckLists,
): GameState => {
  const playerACards = createDeck(deckLists.playerA, 'playerA', 1)
  const playerBCards = createDeck(
    deckLists.playerB,
    'playerB',
    playerACards.length + 1,
  )
  const cardInstances = [...playerACards, ...playerBCards]
  const cards = Object.fromEntries(cardInstances.map((instance) => [instance.id, instance]))
  const playerADeck = shuffleCardIds(
    playerACards.map(({ id }) => id),
    random,
  )
  const playerBDeck = shuffleCardIds(
    playerBCards.map(({ id }) => id),
    random,
  )

  return {
    turn: 1,
    activePlayerId: 'playerA',
    phase: 'keepUp',
    hasAttackedThisTurn: false,
    pendingCombat: null,
    cards,
    players: {
      playerA: createPlayer(
        'playerA',
        'Player A',
        playerADeck,
      ),
      playerB: createPlayer(
        'playerB',
        'Player B',
        playerBDeck,
        SECOND_PLAYER_STARTING_MANA,
      ),
    },
    board: {
      creatures: [],
    },
  }
}

const getKeepUpHandSize = (state: GameState): number =>
  state.turn === 1 && state.activePlayerId === 'playerA' ? 4 : MAX_HAND_SIZE

const replacePlayer = (state: GameState, player: PlayerState): GameState => ({
  ...state,
  players: {
    ...state.players,
    [player.id]: player,
  },
})

const getCardInstance = (state: GameState, cardId: CardInstanceId): CardInstance => {
  const instance = state.cards[cardId]
  if (!instance) {
    throw new Error(`Unknown card instance: ${cardId}`)
  }
  return instance
}

const getCreatureOwner = (state: GameState, creature: CreatureInstance): PlayerId =>
  getCardInstance(state, creature.cardId).ownerId

const removeHandCard = (player: PlayerState, cardId: CardInstanceId): PlayerState => {
  if (!player.hand.includes(cardId)) {
    throw new Error(`Card instance ${cardId} is not in ${player.name}'s hand.`)
  }

  return {
    ...player,
    hand: player.hand.filter((id) => id !== cardId),
  }
}

const drawUpTo = (player: PlayerState, handSize: number): PlayerState => {
  const drawCount = Math.max(0, Math.min(handSize - player.hand.length, player.deck.length))

  return {
    ...player,
    hand: [...player.hand, ...player.deck.slice(0, drawCount)],
    deck: player.deck.slice(drawCount),
  }
}

const discardCard = (player: PlayerState, cardId: CardInstanceId): PlayerState => {
  const playerWithoutCard = removeHandCard(player, cardId)

  return {
    ...playerWithoutCard,
    discard: [...playerWithoutCard.discard, cardId],
  }
}

const getRequiredMarchForInsert = (
  state: GameState,
  ownerId: PlayerId,
  insertIndex: number,
  ignoreCapture: boolean,
): number => {
  const board = state.board.creatures
  const anchorIndexes: Array<number | null> = [
    null,
    ...board.flatMap((_, index) =>
      getCreatureOwnerAt(state, index) === ownerId ? [index] : [],
    ),
  ]

  return Math.min(
    ...anchorIndexes
      .filter(
        (anchorIndex) =>
          anchorIndex === null ||
          isAdjacentInsertToAnchor(anchorIndex, insertIndex) ||
          isForwardInsertFromAnchor(ownerId, anchorIndex, insertIndex),
      )
      .map((anchorIndex) => {
        const crossedIndexes = getCrossedIndexes(
          board.length,
          ownerId,
          anchorIndex,
          insertIndex,
        )
        return crossedIndexes.reduce(
          (distance, crossedIndex) =>
            distance +
            1 +
            (ignoreCapture
              ? 0
              : new CreatureRules(state, crossedIndex).getOpponentMarchCost(ownerId)),
          0,
        )
      }),
  )
}

const getSummonOptionsForState = (
  state: GameState,
  ownerId: PlayerId,
  card: CreatureCard,
  availableMana: number,
): SummonOption[] => {
  const board = state.board.creatures

  return Array.from({ length: board.length + 1 }, (_, insertIndex) => {
    const requiredMarch = getRequiredMarchForInsert(
      state,
      ownerId,
      insertIndex,
      false,
    )
    const costModifier = board.reduce(
      (total, _, boardIndex) =>
        total +
        new CreatureRules(state, boardIndex).getSummonCostModifier(
          ownerId,
          insertIndex,
        ),
      0,
    )
    const effectiveCost = Math.max(0, card.cost + costModifier)
    const canReach = requiredMarch <= card.march
    const affordable = effectiveCost <= availableMana

    return {
      insertIndex,
      requiredMarch,
      effectiveCost,
      canReach,
      affordable,
      canSummon: canReach && affordable,
    }
  })
}

const collectDefendingGroup = (
  state: GameState,
  defenderId: PlayerId,
  targetIndex: number,
  direction: 1 | -1,
): number[] => {
  const board = state.board.creatures
  const indexes: number[] = []
  for (
    let index = targetIndex;
    index >= 0 &&
    index < board.length &&
    getCreatureOwner(state, board[index]) === defenderId;
    index += direction
  ) {
    indexes.push(index)
  }
  return indexes
}

const refundDestroyedCreatures = (
  state: GameState,
  destroyedCreatures: CreatureInstance[],
): GameState['players'] => {
  const nextPlayers = {
    playerA: { ...state.players.playerA, discard: [...state.players.playerA.discard] },
    playerB: { ...state.players.playerB, discard: [...state.players.playerB.discard] },
  }

  destroyedCreatures.forEach((creature) => {
    const instance = getCardInstance(state, creature.cardId)
    const owner = nextPlayers[instance.ownerId]
    const refund = CreatureRules.fromCardId(
      state,
      creature.cardId,
    ).preventsDestructionRefund()
      ? 0
      : Math.floor(instance.card.cost / 2)
    nextPlayers[instance.ownerId] = {
      ...owner,
      mana: owner.mana + refund,
      discard: [...owner.discard, instance.id],
    }
  })

  return nextPlayers
}

const getKeepUpManaBonusForState = (
  state: GameState,
  playerId: PlayerId,
): number => {
  const manaByStackKey = new Map<string, number>()
  state.board.creatures.forEach((_, boardIndex) => {
    const rules = new CreatureRules(state, boardIndex)
    if (rules.ownerId !== playerId) {
      return
    }
    rules.getKeepUpManaModifier().forEach(({ amount, stackKey }) => {
      manaByStackKey.set(stackKey, Math.max(manaByStackKey.get(stackKey) ?? 0, amount))
    })
  })
  const abilityMana = [...manaByStackKey.values()].reduce(
    (total, amount) => total + amount,
    0,
  )
  return abilityMana + getGreenFormationKeepUpMana(state, playerId)
}

const resolveKeepUpState = (state: GameState): GameState => {
  if (state.phase !== 'keepUp') {
    throw new Error('Keep up can only be resolved during the keep up phase.')
  }

  const activePlayer = state.players[state.activePlayerId]
  const bonusMana = getKeepUpManaBonusForState(state, activePlayer.id)
  const nextPlayer = {
    ...drawUpTo(activePlayer, getKeepUpHandSize(state)),
    mana: activePlayer.mana + 2 + bonusMana,
  }

  return {
    ...replacePlayer(state, nextPlayer),
    phase: 'main',
  }
}

const resolvePendingCombatState = (state: GameState): GameState => {
  const { pendingCombat } = state
  if (!pendingCombat) {
    throw new Error('There are no combat results to finish resolving.')
  }

  const destroyedCardIds = new Set(pendingCombat.destroyedCardIds)
  const destroyedCreatures = state.board.creatures.filter(({ cardId }) =>
    destroyedCardIds.has(cardId),
  )
  const nextPlayers = refundDestroyedCreatures(state, destroyedCreatures)
  const defendingPlayer = nextPlayers[pendingCombat.defendingPlayerId]
  nextPlayers[pendingCombat.defendingPlayerId] = {
    ...defendingPlayer,
    hp: defendingPlayer.hp - pendingCombat.playerDamage,
  }

  return {
    ...state,
    players: nextPlayers,
    board: {
      creatures: state.board.creatures.filter(
        ({ cardId }) => !destroyedCardIds.has(cardId),
      ),
    },
    pendingCombat: null,
  }
}

const endTurnState = (state: GameState): GameState => {
  const nextTurnState: GameState = {
    ...state,
    turn: state.turn + 1,
    activePlayerId: getOpponentId(state.activePlayerId),
    phase: 'keepUp',
    hasAttackedThisTurn: false,
    pendingCombat: null,
  }

  return resolveKeepUpState(nextTurnState)
}

export const assertValidGameState = (state: GameState): void => {
  const locations = new Map<CardInstanceId, string>()

  const locate = (
    cardId: CardInstanceId,
    ownerId: PlayerId,
    location: string,
    expectedKind?: CardInstance['card']['kind'],
  ) => {
    const instance = state.cards[cardId]
    if (!instance) {
      throw new Error(`Game state references unknown card instance ${cardId} at ${location}.`)
    }
    if (instance.id !== cardId) {
      throw new Error(`Card registry key ${cardId} does not match instance id ${instance.id}.`)
    }
    if (instance.ownerId !== ownerId) {
      throw new Error(`Card instance ${cardId} is in ${ownerId}'s ${location} but belongs to ${instance.ownerId}.`)
    }
    if (expectedKind && instance.card.kind !== expectedKind) {
      throw new Error(`Card instance ${cardId} at ${location} must be a ${expectedKind}.`)
    }

    const previousLocation = locations.get(cardId)
    if (previousLocation) {
      throw new Error(
        `Card instance ${cardId} exists in both ${previousLocation} and ${location}.`,
      )
    }
    locations.set(cardId, location)
  }

  PLAYER_IDS.forEach((playerId) => {
    const player = state.players[playerId]
    if (player.id !== playerId) {
      throw new Error(`Player registry key ${playerId} does not match player id ${player.id}.`)
    }
    if (player.hand.length > MAX_HAND_SIZE) {
      throw new Error(`${player.name}'s hand cannot contain more than ${MAX_HAND_SIZE} cards.`)
    }
    player.deck.forEach((cardId) => locate(cardId, playerId, 'deck'))
    player.hand.forEach((cardId) => locate(cardId, playerId, 'hand'))
    player.discard.forEach((cardId) => locate(cardId, playerId, 'discard'))
    if (player.formation !== null) {
      locate(player.formation, playerId, 'formation', 'formation')
    }
  })

  state.board.creatures.forEach((creature, index) => {
    const instance = state.cards[creature.cardId]
    if (!instance) {
      throw new Error(`Board references unknown card instance ${creature.cardId}.`)
    }
    locate(creature.cardId, instance.ownerId, `board position ${index}`, 'creature')
  })

  if (state.pendingCombat) {
    if (state.phase !== 'battle' || !state.hasAttackedThisTurn) {
      throw new Error('Pending combat requires the battle phase and a completed attack.')
    }
    if (state.pendingCombat.defendingPlayerId !== getOpponentId(state.activePlayerId)) {
      throw new Error('Pending combat has the wrong defending player.')
    }
    if (
      !Number.isInteger(state.pendingCombat.playerDamage) ||
      state.pendingCombat.playerDamage < 0
    ) {
      throw new Error('Pending combat player damage must be a non-negative integer.')
    }
    if (!state.pendingCombat.playerWasHit && state.pendingCombat.playerDamage !== 0) {
      throw new Error('Combat cannot damage a player it did not reach.')
    }

    const boardCardIds = new Set(state.board.creatures.map(({ cardId }) => cardId))
    const markedCardIds = new Set<CardInstanceId>()
    state.pendingCombat.damageMarkers.forEach(({ cardId, damage }) => {
      if (!boardCardIds.has(cardId)) {
        throw new Error(`Damage marker references card ${cardId} outside the board.`)
      }
      if (!Number.isInteger(damage) || damage <= 0) {
        throw new Error(`Damage marker for card ${cardId} must have positive integer damage.`)
      }
      if (markedCardIds.has(cardId)) {
        throw new Error(`Card ${cardId} has more than one damage marker.`)
      }
      markedCardIds.add(cardId)
    })

    const destroyedCardIds = new Set<CardInstanceId>()
    state.pendingCombat.destroyedCardIds.forEach((cardId) => {
      if (!markedCardIds.has(cardId)) {
        throw new Error(`Destroyed card ${cardId} does not have a damage marker.`)
      }
      if (destroyedCardIds.has(cardId)) {
        throw new Error(`Destroyed card ${cardId} is listed more than once.`)
      }
      destroyedCardIds.add(cardId)
    })
  } else if (state.hasAttackedThisTurn && state.phase !== 'battle') {
    throw new Error('A resolved attack must remain in the battle phase.')
  }

  Object.entries(state.cards).forEach(([registryId, instance]) => {
    if (Number(registryId) !== instance.id) {
      throw new Error(`Card registry key ${registryId} does not match instance id ${instance.id}.`)
    }
    if (!Number.isInteger(instance.id) || instance.id <= 0) {
      throw new Error(`Card instance id must be a positive integer: ${instance.id}.`)
    }
    if (!locations.has(instance.id)) {
      throw new Error(`Card instance ${instance.id} is not in any game zone.`)
    }
  })

  const registeredCardCount = Object.keys(state.cards).length
  if (locations.size !== registeredCardCount) {
    throw new Error(
      `Game state contains ${registeredCardCount} registered cards but ${locations.size} cards in zones.`,
    )
  }
}

export class GameManager {
  public readonly state: GameState

  private constructor(state: GameState) {
    this.state = state
  }

  static create(
    random: () => number = Math.random,
    deckLists: GameDeckLists = DEFAULT_DECK_LISTS,
  ): GameManager {
    return GameManager.from(resolveKeepUpState(createInitialState(random, deckLists)))
  }

  static from(state: GameState): GameManager {
    const clonedState = cloneGameState(state)
    assertValidGameState(clonedState)
    return new GameManager(clonedState)
  }

  static getWinner(manager: GameManager): PlayerId | null {
    return getWinnerFromState(manager.state)
  }

  static getKeepUpManaBonus(manager: GameManager, playerId: PlayerId): number {
    return getKeepUpManaBonusForState(manager.state, playerId)
  }

  static countReachableSummonPositions(
    manager: GameManager,
    playerId: PlayerId,
    march: number,
    ignoreCapture = false,
  ): number {
    return Array.from(
      { length: manager.state.board.creatures.length + 1 },
      (_, insertIndex) => insertIndex,
    ).filter(
      (insertIndex) =>
        getRequiredMarchForInsert(
          manager.state,
          playerId,
          insertIndex,
          ignoreCapture,
        ) <= march,
    ).length
  }

  static setPhase(manager: GameManager, phase: Phase): GameManager {
    return GameManager.from({
      ...manager.state,
      phase,
    })
  }

  static getCurrentPlayer(manager: GameManager): PlayerState {
    return manager.state.players[manager.state.activePlayerId]
  }

  static getOpponent(manager: GameManager): PlayerState {
    const opponentId = getOpponentId(manager.state.activePlayerId)
    return manager.state.players[opponentId]
  }

  static getCard(manager: GameManager, cardId: CardInstanceId): CardInstance {
    return getCardInstance(manager.state, cardId)
  }

  static getCreatureStats(
    manager: GameManager,
    cardId: CardInstanceId,
  ): EffectiveCreatureStats {
    return CreatureRules.fromCardId(manager.state, cardId).getEffectiveStats()
  }

  static getCreatureStatModifier(
    manager: GameManager,
    cardId: CardInstanceId,
  ): CreatureStatModifier {
    return CreatureRules.fromCardId(manager.state, cardId).getPositionStatModifier()
  }

  static getBoardGroups(manager: GameManager): EffectiveBoardGroup[] {
    return collectBoardGroups(manager.state).map((group) => {
      const stats = manager.state.board.creatures
        .slice(group.startIndex, group.endIndex + 1)
        .map((creature) => GameManager.getCreatureStats(manager, creature.cardId))
      return {
        ...group,
        attack: stats.reduce((total, creatureStats) => total + creatureStats.attack, 0),
        defense: stats.reduce((total, creatureStats) => total + creatureStats.defense, 0),
      }
    })
  }

  static getSummonOptions(
    manager: GameManager,
    cardId: CardInstanceId,
  ): SummonOption[] {
    const activePlayer = GameManager.getCurrentPlayer(manager)
    if (!activePlayer.hand.includes(cardId)) {
      return []
    }
    const card = getCardInstance(manager.state, cardId).card
    if (card.kind !== 'creature' || manager.state.phase !== 'main') {
      return []
    }
    return getSummonOptionsForState(
      manager.state,
      activePlayer.id,
      card,
      activePlayer.mana,
    )
  }

  static isCardPlayable(manager: GameManager, cardId: CardInstanceId): boolean {
    const activePlayer = GameManager.getCurrentPlayer(manager)
    if (manager.state.phase !== 'main' || !activePlayer.hand.includes(cardId)) {
      return false
    }
    const card = getCardInstance(manager.state, cardId).card
    if (card.kind === 'creature') {
      return GameManager.getSummonOptions(manager, cardId).some(({ canSummon }) => canSummon)
    }
    return activePlayer.mana >= card.cost
  }

  static getActivatedAbilities(manager: GameManager): ActivatedAbilityOption[] {
    return manager.state.board.creatures.flatMap((_, boardIndex) =>
      new CreatureRules(manager.state, boardIndex).getActivatedActions(),
    )
  }

  static getLegalMainActions(manager: GameManager): GameAction[] {
    if (
      manager.state.phase !== 'main' ||
      manager.state.pendingCombat !== null ||
      GameManager.getWinner(manager) !== null
    ) {
      return []
    }

    const activePlayer = GameManager.getCurrentPlayer(manager)
    const handActions = activePlayer.hand.flatMap((cardId): GameAction[] => {
      const card = getCardInstance(manager.state, cardId).card
      if (card.kind === 'creature') {
        return GameManager.getSummonOptions(manager, cardId)
          .filter(({ canSummon }) => canSummon)
          .map(({ insertIndex }) => ({ type: 'summonCreature', cardId, insertIndex }))
      }
      if (!GameManager.isCardPlayable(manager, cardId)) {
        return []
      }
      return card.kind === 'formation'
        ? [{ type: 'playFormation', cardId }]
        : [{ type: 'playSpell', cardId }]
    })
    const abilityActions = GameManager.getActivatedAbilities(manager).flatMap(
      (option): GameAction[] =>
        option.enabled
          ? [{
              type: 'activateAbility',
              sourceCardId: option.sourceCardId,
              abilityType: option.abilityType,
            }]
          : [],
    )

    return [...handActions, ...abilityActions]
  }

  static getLegalBattleActions(manager: GameManager): GameAction[] {
    if (
      manager.state.phase !== 'battle' ||
      manager.state.hasAttackedThisTurn ||
      manager.state.pendingCombat !== null ||
      GameManager.getWinner(manager) !== null
    ) {
      return []
    }

    return collectBoardGroups(manager.state).flatMap((group): GameAction[] =>
      group.ownerId === manager.state.activePlayerId
        ? [{
            type: 'attackGroup',
            startIndex: group.startIndex,
            endIndex: group.endIndex,
          }]
        : [],
    )
  }

  static getLegalActions(manager: GameManager): GameAction[] {
    if (GameManager.getWinner(manager) !== null) {
      return []
    }
    if (manager.state.pendingCombat !== null) {
      return [{ type: 'finishCombat' }]
    }

    switch (manager.state.phase) {
      case 'keepUp':
        return [{ type: 'resolveKeepUp' }]
      case 'main':
        return [...GameManager.getLegalMainActions(manager), { type: 'passPhase' }]
      case 'battle':
        return [...GameManager.getLegalBattleActions(manager), { type: 'passPhase' }]
      case 'cleanup':
        return [{ type: 'passPhase' }]
    }
  }

  static applyAction(manager: GameManager, action: GameAction): GameManager {
    switch (action.type) {
      case 'resolveKeepUp':
        return GameManager.resolveKeepUp(manager)
      case 'passPhase':
        return GameManager.passPhase(manager)
      case 'summonCreature':
        return GameManager.summonCreature(manager, action.cardId, action.insertIndex)
      case 'playFormation':
        return GameManager.playFormation(manager, action.cardId)
      case 'playSpell':
        return GameManager.playSpell(manager, action.cardId)
      case 'attackGroup':
        return GameManager.attackGroup(manager, action.startIndex, action.endIndex)
      case 'finishCombat':
        return GameManager.finishCombat(manager)
      case 'activateAbility':
        return GameManager.activateAbility(
          manager,
          action.sourceCardId,
          action.abilityType,
        )
      case 'discardFromHand':
        return GameManager.discardFromHand(manager, action.cardId)
    }
  }

  static resolveKeepUp(manager: GameManager): GameManager {
    assertGameInProgress(manager.state)
    return GameManager.from(resolveKeepUpState(manager.state))
  }

  static passPhase(manager: GameManager): GameManager {
    assertGameInProgress(manager.state)
    if (manager.state.pendingCombat) {
      throw new Error('Combat results must finish resolving before the phase can advance.')
    }
    if (manager.state.phase === 'keepUp') {
      return GameManager.resolveKeepUp(manager)
    }

    const currentPhaseIndex = PHASE_ORDER.indexOf(manager.state.phase)
    const nextPhase = PHASE_ORDER[currentPhaseIndex + 1]

    if (manager.state.phase === 'cleanup') {
      return GameManager.from(endTurnState(manager.state))
    }
    if (!nextPhase) {
      throw new Error(`Invalid phase: ${manager.state.phase}`)
    }

    return GameManager.from({
      ...manager.state,
      phase: nextPhase,
    })
  }

  static summonCreature(
    manager: GameManager,
    cardId: CardInstanceId,
    insertIndex: number,
  ): GameManager {
    assertGameInProgress(manager.state)
    if (manager.state.phase !== 'main') {
      throw new Error('Creatures can only be summoned during the main phase.')
    }

    const activePlayer = GameManager.getCurrentPlayer(manager)
    if (!activePlayer.hand.includes(cardId)) {
      throw new Error(`Card instance ${cardId} is not in ${activePlayer.name}'s hand.`)
    }
    const instance = getCardInstance(manager.state, cardId)
    const { card } = instance
    if (card.kind !== 'creature') {
      throw new Error('Selected card is not a creature.')
    }
    const summonOption = GameManager.getSummonOptions(manager, cardId).find(
      (option) => option.insertIndex === insertIndex,
    )
    if (!summonOption?.canReach) {
      throw new Error('The creature cannot be summoned at this position.')
    }
    if (!summonOption.affordable) {
      throw new Error('Not enough mana to summon this creature.')
    }

    const creature: CreatureInstance = {
      cardId,
      summonedTurn: manager.state.turn,
    }
    const playerWithoutCard = removeHandCard(activePlayer, cardId)
    const nextPlayer = {
      ...playerWithoutCard,
      mana: playerWithoutCard.mana - summonOption.effectiveCost,
    }
    const nextCreatures = [
      ...manager.state.board.creatures.slice(0, insertIndex),
      creature,
      ...manager.state.board.creatures.slice(insertIndex),
    ]

    return GameManager.from({
      ...replacePlayer(manager.state, nextPlayer),
      board: {
        creatures: nextCreatures,
      },
    })
  }

  static playFormation(manager: GameManager, cardId: CardInstanceId): GameManager {
    assertGameInProgress(manager.state)
    if (manager.state.phase !== 'main') {
      throw new Error('Formations can only be played during the main phase.')
    }

    const activePlayer = GameManager.getCurrentPlayer(manager)
    if (!activePlayer.hand.includes(cardId)) {
      throw new Error(`Card instance ${cardId} is not in ${activePlayer.name}'s hand.`)
    }
    const instance = getCardInstance(manager.state, cardId)
    if (instance.card.kind !== 'formation') {
      throw new Error('Selected card is not a formation.')
    }
    if (activePlayer.mana < instance.card.cost) {
      throw new Error('Not enough mana to play this formation.')
    }

    const playerWithoutCard = removeHandCard(activePlayer, cardId)
    const oldFormationId = activePlayer.formation
    const nextPlayer = {
      ...playerWithoutCard,
      mana: playerWithoutCard.mana - instance.card.cost,
      formation: cardId,
      discard:
        oldFormationId === null
          ? playerWithoutCard.discard
          : [...playerWithoutCard.discard, oldFormationId],
    }

    return GameManager.from(replacePlayer(manager.state, nextPlayer))
  }

  static playSpell(manager: GameManager, cardId: CardInstanceId): GameManager {
    assertGameInProgress(manager.state)
    if (manager.state.phase !== 'main') {
      throw new Error('Spells can only be played during the main phase.')
    }

    const activePlayer = GameManager.getCurrentPlayer(manager)
    if (!activePlayer.hand.includes(cardId)) {
      throw new Error(`Card instance ${cardId} is not in ${activePlayer.name}'s hand.`)
    }
    const instance = getCardInstance(manager.state, cardId)
    if (instance.card.kind !== 'spell') {
      throw new Error('Selected card is not a spell.')
    }
    if (activePlayer.mana < instance.card.cost) {
      throw new Error('Not enough mana to play this spell.')
    }

    const playerWithoutCard = removeHandCard(activePlayer, cardId)
    const nextPlayer = {
      ...playerWithoutCard,
      mana: playerWithoutCard.mana - instance.card.cost,
      discard: [...playerWithoutCard.discard, cardId],
    }

    return GameManager.from(replacePlayer(manager.state, nextPlayer))
  }

  static attackGroup(manager: GameManager, startIndex: number, endIndex: number): GameManager {
    assertGameInProgress(manager.state)
    if (manager.state.phase !== 'main' && manager.state.phase !== 'battle') {
      throw new Error('Groups can only attack during the main or battle phase.')
    }
    if (manager.state.pendingCombat) {
      throw new Error('The previous combat is still resolving.')
    }
    if (manager.state.hasAttackedThisTurn) {
      throw new Error('Only one group can attack each turn.')
    }

    const attackerId = manager.state.activePlayerId
    const defenderId = getOpponentId(attackerId)
    const board = manager.state.board.creatures
    if (!isWholeGroup(manager.state, attackerId, startIndex, endIndex)) {
      throw new Error('The selected range is not one whole attacking group.')
    }

    const direction = attackerId === 'playerA' ? 1 : -1
    const targetIndex = direction === 1 ? endIndex + 1 : startIndex - 1
    const attackPower = board
      .slice(startIndex, endIndex + 1)
      .reduce(
        (total, creature) =>
          total +
          CreatureRules.fromCardId(manager.state, creature.cardId).getEffectiveStats().attack,
        0,
      )

    if (targetIndex < 0 || targetIndex >= board.length) {
      return GameManager.from({
        ...manager.state,
        phase: 'battle',
        hasAttackedThisTurn: true,
        pendingCombat: {
          damageMarkers: [],
          destroyedCardIds: [],
          defendingPlayerId: defenderId,
          playerWasHit: true,
          playerDamage: Math.max(0, attackPower - PLAYER_BARRIER),
        },
      })
    }
    if (getCreatureOwner(manager.state, board[targetIndex]) !== defenderId) {
      throw new Error('The attacking group is not adjacent to an enemy group or player.')
    }

    const defendingGroupIndexes = collectDefendingGroup(
      manager.state,
      defenderId,
      targetIndex,
      direction,
    )
    let remainingAttack = attackPower
    const destroyedIndexes: number[] = []
    const damageMarkers: NonNullable<GameState['pendingCombat']>['damageMarkers'] = []

    for (const index of defendingGroupIndexes) {
      const defender = board[index]
      if (remainingAttack <= 0) {
        break
      }
      damageMarkers.push({
        cardId: defender.cardId,
        damage: remainingAttack,
      })

      const defense = CreatureRules.fromCardId(
        manager.state,
        defender.cardId,
      ).getEffectiveStats().defense
      if (remainingAttack < defense) {
        break
      }
      remainingAttack -= defense
      destroyedIndexes.push(index)
    }

    const groupTouchedDefenderPlayer =
      direction === 1
        ? defendingGroupIndexes.at(-1) === board.length - 1
        : defendingGroupIndexes.at(-1) === 0
    const playerWasHit =
      destroyedIndexes.length === defendingGroupIndexes.length && groupTouchedDefenderPlayer
    const playerDamage = playerWasHit ? Math.max(0, remainingAttack - PLAYER_BARRIER) : 0
    const defendingFront = board[targetIndex]
    const counterDamage = CreatureRules.fromCardId(
      manager.state,
      defendingFront.cardId,
    ).getCounterAttack()
    if (counterDamage > 0) {
      const attackingFrontIndex = attackerId === 'playerA' ? endIndex : startIndex
      const attackingFront = board[attackingFrontIndex]
      damageMarkers.push({ cardId: attackingFront.cardId, damage: counterDamage })
      const attackingFrontDefense = CreatureRules.fromCardId(
        manager.state,
        attackingFront.cardId,
      ).getEffectiveStats().defense
      if (counterDamage >= attackingFrontDefense) {
        destroyedIndexes.push(attackingFrontIndex)
      }
    }

    return GameManager.from({
      ...manager.state,
      phase: 'battle',
      hasAttackedThisTurn: true,
      pendingCombat: {
        damageMarkers,
        destroyedCardIds: [...new Set(destroyedIndexes.map((index) => board[index].cardId))],
        defendingPlayerId: defenderId,
        playerWasHit,
        playerDamage,
      },
    })
  }

  static previewCombat(
    manager: GameManager,
    startIndex: number,
    endIndex: number,
  ): CombatPreview {
    const attackerId = manager.state.activePlayerId
    const pendingManager = GameManager.attackGroup(manager, startIndex, endIndex)
    const pendingCombat = pendingManager.state.pendingCombat
    if (!pendingCombat) {
      throw new Error('Combat preview did not produce combat results.')
    }

    const resolvedState = resolvePendingCombatState(pendingManager.state)
    const refundedMana = Object.fromEntries(
      PLAYER_IDS.flatMap((playerId) => {
        const refund = resolvedState.players[playerId].mana - manager.state.players[playerId].mana
        return refund > 0 ? [[playerId, refund]] : []
      }),
    ) as Partial<Record<PlayerId, number>>

    return {
      attackerId,
      attackingGroup: { startIndex, endIndex },
      destroyedCardIds: [...pendingCombat.destroyedCardIds],
      refundedMana,
      playerDamage: pendingCombat.playerDamage,
      nextState: GameManager.from(resolvedState).state,
    }
  }

  static finishCombat(manager: GameManager): GameManager {
    const resolvedState = resolvePendingCombatState(manager.state)
    return GameManager.from(
      getWinnerFromState(resolvedState) === null
        ? endTurnState(resolvedState)
        : resolvedState,
    )
  }

  static activateAbility(
    manager: GameManager,
    sourceCardId: CardInstanceId,
    abilityType: ActivatedAbilityType,
  ): GameManager {
    assertGameInProgress(manager.state)
    const rules = CreatureRules.fromCardId(manager.state, sourceCardId)
    const option = rules
      .getActivatedActions()
      .find((candidate) => candidate.abilityType === abilityType)
    if (!option) {
      throw new Error(`Creature card ${sourceCardId} does not have ${abilityType}.`)
    }
    if (!option.enabled) {
      throw new Error(option.reason ?? 'This ability cannot be activated now.')
    }

    const resolution = rules.getActivatedAbilityResolution(abilityType)
    const owner = manager.state.players[rules.ownerId]
    const nextOwner = {
      ...owner,
      mana: owner.mana + resolution.mana,
      [resolution.destination]: [...owner[resolution.destination], sourceCardId],
    }

    return GameManager.from({
      ...replacePlayer(manager.state, nextOwner),
      board: {
        creatures: manager.state.board.creatures.filter(
          ({ cardId }) => cardId !== sourceCardId,
        ),
      },
    })
  }

  static discardFromHand(manager: GameManager, cardId: CardInstanceId): GameManager {
    assertGameInProgress(manager.state)
    if (manager.state.pendingCombat) {
      throw new Error('Cards cannot be discarded while combat is resolving.')
    }
    const activePlayer = GameManager.getCurrentPlayer(manager)
    return GameManager.from(replacePlayer(manager.state, discardCard(activePlayer, cardId)))
  }
}
