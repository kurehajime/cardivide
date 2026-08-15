import { describe, expect, it } from 'vitest'
import { GameManager, assertValidGameState } from './GameManager'
import type { CardInstanceId, GameState, PlayerId } from './types'

const collectZoneIds = (state: GameState): CardInstanceId[] => {
  const ids: CardInstanceId[] = []

  ;(['playerA', 'playerB'] as const).forEach((playerId) => {
    const player = state.players[playerId]
    ids.push(...player.deck, ...player.hand, ...player.discard)
    if (player.formation !== null) {
      ids.push(player.formation)
    }
  })
  ids.push(...state.board.creatures.map(({ cardId }) => cardId))

  return ids
}

const expectCardsConserved = (manager: GameManager) => {
  const zoneIds = collectZoneIds(manager.state)

  expect(zoneIds).toHaveLength(96)
  expect(new Set(zoneIds).size).toBe(96)
  expect(Object.keys(manager.state.cards)).toHaveLength(96)
  expect(() => assertValidGameState(manager.state)).not.toThrow()
}

const passTurnWithoutAttack = (manager: GameManager): GameManager => {
  let nextManager = manager
  while (nextManager.state.activePlayerId === manager.state.activePlayerId) {
    nextManager = GameManager.passPhase(nextManager)
  }
  return nextManager
}

const moveDeckCardToHand = (
  manager: GameManager,
  playerId: PlayerId,
  cardId: CardInstanceId,
  mana: number,
): GameManager => {
  const player = manager.state.players[playerId]
  if (!player.deck.includes(cardId)) {
    throw new Error(`Test card ${cardId} is not in the deck.`)
  }

  return GameManager.from({
    ...manager.state,
    players: {
      ...manager.state.players,
      [playerId]: {
        ...player,
        mana,
        deck: player.deck.filter((id) => id !== cardId),
        hand: [...player.hand, cardId],
      },
    },
  })
}

describe('GameManager card instance tracking', () => {
  it('assigns one globally unique sequential id to every physical deck card', () => {
    const manager = GameManager.create()
    const instances = Object.values(manager.state.cards)

    expect(instances.map(({ id }) => id)).toEqual(
      Array.from({ length: 96 }, (_, index) => index + 1),
    )
    expect(instances.slice(0, 3).map(({ card }) => card.definitionId)).toEqual([
      'red-cost2-attack3-defense2-march1',
      'red-cost2-attack3-defense2-march1',
      'red-cost2-attack3-defense2-march1',
    ])
    expect(new Set(instances.slice(0, 3).map(({ id }) => id)).size).toBe(3)
    expectCardsConserved(manager)
  })

  it('moves only the selected physical card from hand to board', () => {
    const manager = GameManager.create()
    const [firstCopy, selectedCopy, thirdCopy] = manager.state.players.playerA.hand
    const nextManager = GameManager.summonCreature(manager, selectedCopy, 0)

    expect(nextManager.state.players.playerA.hand).toContain(firstCopy)
    expect(nextManager.state.players.playerA.hand).not.toContain(selectedCopy)
    expect(nextManager.state.players.playerA.hand).toContain(thirdCopy)
    expect(nextManager.state.board.creatures.map(({ cardId }) => cardId)).toEqual([selectedCopy])
    expect(nextManager.state.players.playerA.hand).toHaveLength(3)
    expect(() => GameManager.summonCreature(nextManager, selectedCopy, 0)).toThrow(
      /is not in Player A's hand/,
    )
    expectCardsConserved(nextManager)
  })

  it('draws only enough cards to reach five on later keep-up phases', () => {
    let manager = GameManager.create()
    const summonedCardId = manager.state.players.playerA.hand[0]
    manager = GameManager.summonCreature(manager, summonedCardId, 0)
    manager = GameManager.attackGroup(manager, 0, 0)

    expect(manager.state.activePlayerId).toBe('playerB')
    expect(manager.state.players.playerB.hand).toHaveLength(5)
    manager = passTurnWithoutAttack(manager)

    expect(manager.state.activePlayerId).toBe('playerA')
    expect(manager.state.players.playerA.hand).toHaveLength(5)
    expect(manager.state.players.playerA.deck).toHaveLength(42)
    expectCardsConserved(manager)
  })

  it('never grows either hand beyond five while turns advance', () => {
    let manager = GameManager.create()

    for (let turn = 0; turn < 20; turn += 1) {
      manager = passTurnWithoutAttack(manager)
      expect(manager.state.players.playerA.hand.length).toBeLessThanOrEqual(5)
      expect(manager.state.players.playerB.hand.length).toBeLessThanOrEqual(5)
      expectCardsConserved(manager)
    }
  })

  it('moves destroyed cards from the board to their owner discard pile', () => {
    let manager = GameManager.create()
    const playerACardId = manager.state.players.playerA.hand[0]
    manager = GameManager.summonCreature(manager, playerACardId, 0)
    manager = GameManager.attackGroup(manager, 0, 0)

    const playerBCardId = manager.state.players.playerB.hand[0]
    manager = GameManager.summonCreature(manager, playerBCardId, 1)
    manager = GameManager.attackGroup(manager, 1, 1)

    expect(manager.state.board.creatures.some(({ cardId }) => cardId === playerACardId)).toBe(false)
    expect(manager.state.players.playerA.discard).toContain(playerACardId)
    expect(manager.state.players.playerA.hand).toHaveLength(5)
    expectCardsConserved(manager)
  })

  it('tracks formation replacement with the same physical card ids', () => {
    let manager = moveDeckCardToHand(GameManager.create(), 'playerA', 16, 4)
    manager = GameManager.playFormation(manager, 16)

    expect(manager.state.players.playerA.formation).toBe(16)
    expect(manager.state.players.playerA.hand).not.toContain(16)

    manager = moveDeckCardToHand(manager, 'playerA', 32, 4)
    manager = GameManager.playFormation(manager, 32)

    expect(manager.state.players.playerA.formation).toBe(32)
    expect(manager.state.players.playerA.discard).toContain(16)
    expectCardsConserved(manager)
  })

  it('rejects duplicate zones, orphaned cards, and a six-card hand', () => {
    const manager = GameManager.create()
    const playerA = manager.state.players.playerA
    const duplicateId = playerA.hand[0]
    const duplicatedState: GameState = {
      ...manager.state,
      players: {
        ...manager.state.players,
        playerA: {
          ...playerA,
          deck: [...playerA.deck, duplicateId],
        },
      },
    }
    expect(() => GameManager.from(duplicatedState)).toThrow(/exists in both/)

    const [fifthCardId, sixthCardId] = playerA.deck
    const sixCardHandState: GameState = {
      ...manager.state,
      players: {
        ...manager.state.players,
        playerA: {
          ...playerA,
          deck: playerA.deck.slice(2),
          hand: [...playerA.hand, fifthCardId, sixthCardId],
        },
      },
    }
    expect(() => GameManager.from(sixCardHandState)).toThrow(/cannot contain more than 5 cards/)

    const orphanedState: GameState = {
      ...manager.state,
      players: {
        ...manager.state.players,
        playerA: {
          ...playerA,
          deck: playerA.deck.slice(1),
        },
      },
    }
    expect(() => GameManager.from(orphanedState)).toThrow(/is not in any game zone/)
  })
})
