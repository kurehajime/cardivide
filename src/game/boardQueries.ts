import type {
  CardColor,
  CardInstanceId,
  CreatureCard,
  CreatureInstance,
  GameState,
  PlayerId,
} from './types'

export type BoardGroupRange = {
  ownerId: PlayerId
  startIndex: number
  endIndex: number
}

export const getOpponentId = (playerId: PlayerId): PlayerId =>
  playerId === 'playerA' ? 'playerB' : 'playerA'

export const getCreatureOwnerAt = (state: GameState, boardIndex: number): PlayerId => {
  const creature = state.board.creatures[boardIndex]
  if (!creature) {
    throw new Error(`No creature exists at board position ${boardIndex}.`)
  }

  const instance = state.cards[creature.cardId]
  if (!instance || instance.card.kind !== 'creature') {
    throw new Error(`Board position ${boardIndex} does not contain a creature card.`)
  }
  return instance.ownerId
}

export const getCreatureCardAt = (state: GameState, boardIndex: number): CreatureCard => {
  const creature = state.board.creatures[boardIndex]
  if (!creature) {
    throw new Error(`No creature exists at board position ${boardIndex}.`)
  }

  const card = state.cards[creature.cardId]?.card
  if (!card || card.kind !== 'creature') {
    throw new Error(`Board position ${boardIndex} does not contain a creature card.`)
  }
  return card
}

export const getCreatureAt = (state: GameState, boardIndex: number): CreatureInstance => {
  const creature = state.board.creatures[boardIndex]
  if (!creature) {
    throw new Error(`No creature exists at board position ${boardIndex}.`)
  }
  return creature
}

export const findCreatureIndex = (
  state: GameState,
  cardId: CardInstanceId,
): number => state.board.creatures.findIndex((creature) => creature.cardId === cardId)

export const collectBoardGroups = (state: GameState): BoardGroupRange[] => {
  const groups: BoardGroupRange[] = []
  let index = 0

  while (index < state.board.creatures.length) {
    const ownerId = getCreatureOwnerAt(state, index)
    const startIndex = index
    while (
      index + 1 < state.board.creatures.length &&
      getCreatureOwnerAt(state, index + 1) === ownerId
    ) {
      index += 1
    }
    groups.push({ ownerId, startIndex, endIndex: index })
    index += 1
  }

  return groups
}

export const getGroupAt = (state: GameState, boardIndex: number): BoardGroupRange => {
  const group = collectBoardGroups(state).find(
    ({ startIndex, endIndex }) => boardIndex >= startIndex && boardIndex <= endIndex,
  )
  if (!group) {
    throw new Error(`No group exists at board position ${boardIndex}.`)
  }
  return group
}

const getEndpointOwner = (
  state: GameState,
  adjacentIndex: number,
): PlayerId | null => {
  if (adjacentIndex === -1) {
    return 'playerA'
  }
  if (adjacentIndex === state.board.creatures.length) {
    return 'playerB'
  }
  return null
}

export const isEnemyAtOrBeyondEndpoint = (
  state: GameState,
  ownerId: PlayerId,
  adjacentIndex: number,
): boolean => {
  const endpointOwner = getEndpointOwner(state, adjacentIndex)
  if (endpointOwner !== null) {
    return endpointOwner !== ownerId
  }
  if (adjacentIndex < 0 || adjacentIndex >= state.board.creatures.length) {
    return false
  }
  return getCreatureOwnerAt(state, adjacentIndex) !== ownerId
}

export const isCreatureFlankedByEnemies = (
  state: GameState,
  boardIndex: number,
): boolean => {
  const ownerId = getCreatureOwnerAt(state, boardIndex)
  return (
    isEnemyAtOrBeyondEndpoint(state, ownerId, boardIndex - 1) &&
    isEnemyAtOrBeyondEndpoint(state, ownerId, boardIndex + 1)
  )
}

export const isGroupFlankedByEnemies = (
  state: GameState,
  group: BoardGroupRange,
): boolean =>
  isEnemyAtOrBeyondEndpoint(state, group.ownerId, group.startIndex - 1) &&
  isEnemyAtOrBeyondEndpoint(state, group.ownerId, group.endIndex + 1)

export const isAdjacentToEnemyPlayer = (
  state: GameState,
  boardIndex: number,
): boolean => {
  const ownerId = getCreatureOwnerAt(state, boardIndex)
  return ownerId === 'playerA'
    ? boardIndex === state.board.creatures.length - 1
    : boardIndex === 0
}

export const getFrontIndex = (group: BoardGroupRange): number =>
  group.ownerId === 'playerA' ? group.endIndex : group.startIndex

export const getRearNeighborIndex = (
  state: GameState,
  boardIndex: number,
): number | null => {
  const ownerId = getCreatureOwnerAt(state, boardIndex)
  const rearIndex = ownerId === 'playerA' ? boardIndex - 1 : boardIndex + 1
  return rearIndex >= 0 && rearIndex < state.board.creatures.length ? rearIndex : null
}

export const countOwnerGroupsContainingColor = (
  state: GameState,
  ownerId: PlayerId,
  color: CardColor,
): number =>
  collectBoardGroups(state).filter(
    (group) =>
      group.ownerId === ownerId &&
      state.board.creatures
        .slice(group.startIndex, group.endIndex + 1)
        .some((_, offset) => getCreatureCardAt(state, group.startIndex + offset).color === color),
  ).length

export const isWholeGroup = (
  state: GameState,
  ownerId: PlayerId,
  startIndex: number,
  endIndex: number,
): boolean =>
  collectBoardGroups(state).some(
    (group) =>
      group.ownerId === ownerId &&
      group.startIndex === startIndex &&
      group.endIndex === endIndex,
  )

export const getCrossedIndexes = (
  boardLength: number,
  ownerId: PlayerId,
  anchorIndex: number | null,
  insertIndex: number,
): number[] => {
  if (insertIndex < 0 || insertIndex > boardLength) {
    return []
  }

  if (anchorIndex === null) {
    return ownerId === 'playerA'
      ? Array.from({ length: insertIndex }, (_, index) => index)
      : Array.from({ length: boardLength - insertIndex }, (_, index) => insertIndex + index)
  }

  if (insertIndex <= anchorIndex) {
    return Array.from(
      { length: anchorIndex - insertIndex },
      (_, index) => insertIndex + index,
    )
  }

  return Array.from(
    { length: insertIndex - anchorIndex - 1 },
    (_, index) => anchorIndex + index + 1,
  )
}
