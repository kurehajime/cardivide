import { createStandardDeck } from './decks'
import type {
  Card,
  CreatureCard,
  CreatureInstance,
  GameAction,
  GameState,
  Phase,
  PlayerId,
  PlayerState,
} from './types'

const PHASE_ORDER = ['main', 'battle', 'cleanup'] satisfies Phase[]

const PLAYER_BARRIER = 2

const getOpponentId = (playerId: PlayerId): PlayerId =>
  playerId === 'playerA' ? 'playerB' : 'playerA'

const createPlayer = (id: PlayerId, name: string): PlayerState => {
  const deck = createStandardDeck()

  return {
    id,
    name,
    hp: 20,
    mana: 0,
    deck,
    hand: [],
    discard: [],
    formation: null,
  }
}

const clonePlayer = (player: PlayerState): PlayerState => ({
  ...player,
  deck: [...player.deck],
  hand: [...player.hand],
  discard: [...player.discard],
})

const cloneGameState = (state: GameState): GameState => ({
  ...state,
  players: {
    playerA: clonePlayer(state.players.playerA),
    playerB: clonePlayer(state.players.playerB),
  },
  board: {
    creatures: state.board.creatures.map((creature) => ({ ...creature })),
  },
})

const createInitialState = (): GameState => ({
  turn: 1,
  activePlayerId: 'playerA',
  phase: 'keepUp',
  hasAttackedThisTurn: false,
  nextCreatureInstanceId: 1,
  players: {
    playerA: createPlayer('playerA', 'Player A'),
    playerB: createPlayer('playerB', 'Player B'),
  },
  board: {
    creatures: [],
  },
})

const getKeepUpHandSize = (state: GameState): number =>
  state.turn === 1 && state.activePlayerId === 'playerA' ? 4 : 5

const replacePlayer = (state: GameState, player: PlayerState): GameState => ({
  ...state,
  players: {
    ...state.players,
    [player.id]: player,
  },
})

const removeHandCard = (
  player: PlayerState,
  handIndex: number,
): { player: PlayerState; card: Card } => {
  const card = player.hand[handIndex]
  if (!card) {
    throw new Error(`Invalid hand index: ${handIndex}`)
  }

  return {
    card,
    player: {
      ...player,
      hand: player.hand.filter((_, index) => index !== handIndex),
    },
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

const cleanupPlayer = (player: PlayerState): PlayerState => {
  const maxHandSize = 5
  if (player.hand.length <= maxHandSize) {
    return player
  }

  return {
    ...player,
    hand: player.hand.slice(0, maxHandSize),
    discard: [...player.discard, ...player.hand.slice(maxHandSize)],
  }
}

const discardAt = (player: PlayerState, handIndex: number): PlayerState => {
  const { card, player: playerWithoutCard } = removeHandCard(player, handIndex)

  return {
    ...playerWithoutCard,
    discard: [...playerWithoutCard.discard, card],
  }
}

const canInsertCreature = (
  board: CreatureInstance[],
  ownerId: PlayerId,
  card: CreatureCard,
  insertIndex: number,
): boolean => {
  if (insertIndex < 0 || insertIndex > board.length) {
    return false
  }

  if (ownerId === 'playerA' && insertIndex <= card.march) {
    return true
  }
  if (ownerId === 'playerB' && board.length - insertIndex <= card.march) {
    return true
  }

  return board.some((creature, index) => {
    if (creature.ownerId !== ownerId) {
      return false
    }
    return Math.max(0, Math.abs(insertIndex - index) - 1) <= card.march
  })
}

const isWholeGroup = (
  board: CreatureInstance[],
  ownerId: PlayerId,
  startIndex: number,
  endIndex: number,
): boolean => {
  if (
    startIndex < 0 ||
    endIndex >= board.length ||
    startIndex > endIndex ||
    board.slice(startIndex, endIndex + 1).some((creature) => creature.ownerId !== ownerId)
  ) {
    return false
  }

  return board[startIndex - 1]?.ownerId !== ownerId && board[endIndex + 1]?.ownerId !== ownerId
}

const collectDefendingGroup = (
  board: CreatureInstance[],
  defenderId: PlayerId,
  targetIndex: number,
  direction: 1 | -1,
): number[] => {
  const indexes: number[] = []
  for (
    let index = targetIndex;
    index >= 0 && index < board.length && board[index].ownerId === defenderId;
    index += direction
  ) {
    indexes.push(index)
  }
  return indexes
}

const refundDestroyedCreatures = (
  players: GameState['players'],
  destroyedCreatures: CreatureInstance[],
): GameState['players'] => {
  const nextPlayers = {
    playerA: { ...players.playerA, discard: [...players.playerA.discard] },
    playerB: { ...players.playerB, discard: [...players.playerB.discard] },
  }

  destroyedCreatures.forEach((creature) => {
    const owner = nextPlayers[creature.ownerId]
    nextPlayers[creature.ownerId] = {
      ...owner,
      mana: owner.mana + Math.floor(creature.card.cost / 2),
      discard: [...owner.discard, creature.card],
    }
  })

  return nextPlayers
}

const resolveKeepUpState = (state: GameState): GameState => {
  if (state.phase !== 'keepUp') {
    throw new Error('Keep up can only be resolved during the keep up phase.')
  }

  const activePlayer = state.players[state.activePlayerId]
  const handSize = getKeepUpHandSize(state)
  const nextPlayer = {
    ...drawUpTo(activePlayer, handSize),
    mana: activePlayer.mana + 2,
  }

  return {
    ...replacePlayer(state, nextPlayer),
    phase: 'main',
  }
}

const endTurnState = (state: GameState): GameState => {
  const cleanedState = replacePlayer(state, cleanupPlayer(state.players[state.activePlayerId]))
  const nextTurnState: GameState = {
    ...cleanedState,
    turn: cleanedState.turn + 1,
    activePlayerId: getOpponentId(cleanedState.activePlayerId),
    phase: 'keepUp',
    hasAttackedThisTurn: false,
  }

  return resolveKeepUpState(nextTurnState)
}

export class GameManager {
  public readonly state: GameState

  private constructor(state: GameState) {
    this.state = state
  }

  static create(): GameManager {
    return GameManager.from(resolveKeepUpState(createInitialState()))
  }

  static from(state: GameState): GameManager {
    return new GameManager(cloneGameState(state))
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

  static applyAction(manager: GameManager, action: GameAction): GameManager {
    switch (action.type) {
      case 'resolveKeepUp':
        return GameManager.resolveKeepUp(manager)
      case 'passPhase':
        return GameManager.passPhase(manager)
      case 'summonCreature':
        return GameManager.summonCreature(manager, action.handIndex, action.insertIndex)
      case 'playFormation':
        return GameManager.playFormation(manager, action.handIndex)
      case 'playSpell':
        return GameManager.playSpell(manager, action.handIndex)
      case 'attackGroup':
        return GameManager.attackGroup(manager, action.startIndex, action.endIndex)
      case 'discardFromHand':
        return GameManager.discardFromHand(manager, action.handIndex)
    }
  }

  static resolveKeepUp(manager: GameManager): GameManager {
    return GameManager.from(resolveKeepUpState(manager.state))
  }

  static passPhase(manager: GameManager): GameManager {
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

  static summonCreature(manager: GameManager, handIndex: number, insertIndex: number): GameManager {
    if (manager.state.phase !== 'main') {
      throw new Error('Creatures can only be summoned during the main phase.')
    }

    const activePlayer = GameManager.getCurrentPlayer(manager)
    const { card, player: playerWithoutCard } = removeHandCard(activePlayer, handIndex)
    if (card.kind !== 'creature') {
      throw new Error('Selected card is not a creature.')
    }
    if (activePlayer.mana < card.cost) {
      throw new Error('Not enough mana to summon this creature.')
    }
    if (!canInsertCreature(manager.state.board.creatures, activePlayer.id, card, insertIndex)) {
      throw new Error('The creature cannot be summoned at this position.')
    }

    const creature: CreatureInstance = {
      instanceId: `creature-${manager.state.nextCreatureInstanceId}`,
      ownerId: activePlayer.id,
      card,
      summonedTurn: manager.state.turn,
    }
    const nextPlayer = {
      ...playerWithoutCard,
      mana: playerWithoutCard.mana - card.cost,
    }
    const nextCreatures = [
      ...manager.state.board.creatures.slice(0, insertIndex),
      creature,
      ...manager.state.board.creatures.slice(insertIndex),
    ]

    return GameManager.from({
      ...replacePlayer(manager.state, nextPlayer),
      nextCreatureInstanceId: manager.state.nextCreatureInstanceId + 1,
      board: {
        creatures: nextCreatures,
      },
    })
  }

  static playFormation(manager: GameManager, handIndex: number): GameManager {
    if (manager.state.phase !== 'main') {
      throw new Error('Formations can only be played during the main phase.')
    }

    const activePlayer = GameManager.getCurrentPlayer(manager)
    const { card, player: playerWithoutCard } = removeHandCard(activePlayer, handIndex)
    if (card.kind !== 'formation') {
      throw new Error('Selected card is not a formation.')
    }
    if (activePlayer.mana < card.cost) {
      throw new Error('Not enough mana to play this formation.')
    }

    const oldFormation = activePlayer.formation
    const nextPlayer = {
      ...playerWithoutCard,
      mana: playerWithoutCard.mana - card.cost,
      formation: card,
      discard: oldFormation
        ? [...playerWithoutCard.discard, oldFormation]
        : playerWithoutCard.discard,
    }

    return GameManager.from(replacePlayer(manager.state, nextPlayer))
  }

  static playSpell(manager: GameManager, handIndex: number): GameManager {
    if (manager.state.phase !== 'main') {
      throw new Error('Spells can only be played during the main phase.')
    }

    const activePlayer = GameManager.getCurrentPlayer(manager)
    const { card, player: playerWithoutCard } = removeHandCard(activePlayer, handIndex)
    if (card.kind !== 'spell') {
      throw new Error('Selected card is not a spell.')
    }
    if (activePlayer.mana < card.cost) {
      throw new Error('Not enough mana to play this spell.')
    }

    const nextPlayer = {
      ...playerWithoutCard,
      mana: playerWithoutCard.mana - card.cost,
      discard: [...playerWithoutCard.discard, card],
    }

    return GameManager.from(replacePlayer(manager.state, nextPlayer))
  }

  static attackGroup(manager: GameManager, startIndex: number, endIndex: number): GameManager {
    if (manager.state.phase !== 'main' && manager.state.phase !== 'battle') {
      throw new Error('Groups can only attack during the main or battle phase.')
    }
    if (manager.state.hasAttackedThisTurn) {
      throw new Error('Only one group can attack each turn.')
    }

    const attackerId = manager.state.activePlayerId
    const defenderId = getOpponentId(attackerId)
    const board = manager.state.board.creatures
    if (!isWholeGroup(board, attackerId, startIndex, endIndex)) {
      throw new Error('The selected range is not one whole attacking group.')
    }

    const direction = attackerId === 'playerA' ? 1 : -1
    const targetIndex = direction === 1 ? endIndex + 1 : startIndex - 1
    const attackPower = board
      .slice(startIndex, endIndex + 1)
      .reduce((total, creature) => total + creature.card.attack, 0)

    if (targetIndex < 0 || targetIndex >= board.length) {
      return GameManager.damagePlayer(
        GameManager.from({ ...manager.state, phase: 'battle' }),
        defenderId,
        Math.max(0, attackPower - PLAYER_BARRIER),
      )
    }
    if (board[targetIndex].ownerId !== defenderId) {
      throw new Error('The attacking group is not adjacent to an enemy group or player.')
    }

    const defendingGroupIndexes = collectDefendingGroup(board, defenderId, targetIndex, direction)
    let remainingAttack = attackPower
    const destroyedIndexes: number[] = []

    for (const index of defendingGroupIndexes) {
      const defender = board[index]
      if (remainingAttack < defender.card.defense) {
        break
      }
      remainingAttack -= defender.card.defense
      destroyedIndexes.push(index)
    }

    const destroyedSet = new Set(destroyedIndexes)
    const destroyedCreatures = board.filter((_, index) => destroyedSet.has(index))
    const nextPlayers = refundDestroyedCreatures(manager.state.players, destroyedCreatures)
    const nextBoard = board.filter((_, index) => !destroyedSet.has(index))
    const groupTouchedDefenderPlayer =
      direction === 1
        ? defendingGroupIndexes.at(-1) === board.length - 1
        : defendingGroupIndexes.at(-1) === 0

    if (destroyedIndexes.length === defendingGroupIndexes.length && groupTouchedDefenderPlayer) {
      nextPlayers[defenderId] = {
        ...nextPlayers[defenderId],
        hp: nextPlayers[defenderId].hp - Math.max(0, remainingAttack - PLAYER_BARRIER),
      }
    }

    return GameManager.from({
      ...endTurnState({
        ...manager.state,
        phase: 'battle',
        players: nextPlayers,
        board: {
          creatures: nextBoard,
        },
        hasAttackedThisTurn: true,
      }),
    })
  }

  static discardFromHand(manager: GameManager, handIndex: number): GameManager {
    const activePlayer = GameManager.getCurrentPlayer(manager)
    return GameManager.from(replacePlayer(manager.state, discardAt(activePlayer, handIndex)))
  }

  private static damagePlayer(
    manager: GameManager,
    playerId: PlayerId,
    damage: number,
  ): GameManager {
    const player = manager.state.players[playerId]
    const nextPlayer = {
      ...player,
      hp: player.hp - damage,
    }

    return GameManager.from(
      endTurnState({
        ...replacePlayer(manager.state, nextPlayer),
        hasAttackedThisTurn: true,
      }),
    )
  }
}
