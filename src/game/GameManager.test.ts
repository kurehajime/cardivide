import { describe, expect, it } from 'vitest'
import { CARD_DEFINITION_IDS } from './cards'
import { GameManager, assertValidGameState } from './GameManager'
import type { CardInstanceId, GameState } from './types'

const KEEP_ORDER_RANDOM = () => 1 - Number.EPSILON
const CARD_ID = CARD_DEFINITION_IDS

const createTestManager = (): GameManager => GameManager.create(KEEP_ORDER_RANDOM)

const collectZoneIds = (state: GameState): CardInstanceId[] => {
  const ids: CardInstanceId[] = []

  ;(['playerA', 'playerB'] as const).forEach((playerId) => {
    const player = state.players[playerId]
    ids.push(...player.deck, ...player.hand, ...player.discard, ...player.exile)
    if (player.placedSpell !== null) {
      ids.push(player.placedSpell.cardId)
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

describe('GameManager card instance tracking', () => {
  it('adds one mana to the selected player for local debugging', () => {
    const initial = createTestManager()
    const initialPlayerAMana = initial.state.players.playerA.mana
    const initialPlayerBMana = initial.state.players.playerB.mana
    const updated = GameManager.addDebugMana(initial, 'playerA')

    expect(updated.state.players.playerA.mana).toBe(initialPlayerAMana + 1)
    expect(updated.state.players.playerB.mana).toBe(initialPlayerBMana)
  })

  it('assigns one globally unique sequential id to every physical deck card', () => {
    const manager = createTestManager()
    const instances = Object.values(manager.state.cards)

    expect(instances.map(({ id }) => id)).toEqual(
      Array.from({ length: 96 }, (_, index) => index + 1),
    )
    expect(instances.slice(0, 3).map(({ card }) => card.definitionId)).toEqual([
      CARD_ID.SPARK_SWORDSMAN,
      CARD_ID.SPARK_SWORDSMAN,
      CARD_ID.SPARK_SWORDSMAN,
    ])
    expect(new Set(instances.slice(0, 3).map(({ id }) => id)).size).toBe(3)
    expectCardsConserved(manager)
  })

  it('shuffles both decks before the first hand is drawn', () => {
    const manager = GameManager.create(() => 0)
    const playerAOrder = [
      ...manager.state.players.playerA.hand,
      ...manager.state.players.playerA.deck,
    ]
    const playerBOrder = manager.state.players.playerB.deck

    expect(playerAOrder).not.toEqual(Array.from({ length: 48 }, (_, index) => index + 1))
    expect(playerBOrder).not.toEqual(Array.from({ length: 48 }, (_, index) => index + 49))
    expect([...playerAOrder].sort((left, right) => left - right)).toEqual(
      Array.from({ length: 48 }, (_, index) => index + 1),
    )
    expect([...playerBOrder].sort((left, right) => left - right)).toEqual(
      Array.from({ length: 48 }, (_, index) => index + 49),
    )
    expectCardsConserved(manager)
  })

  it('moves only the selected physical card from hand to board', () => {
    const manager = createTestManager()
    const [firstCopy, selectedCopy, thirdCopy] = manager.state.players.playerA.hand
    const nextManager = GameManager.summonCreature(manager, selectedCopy, 0)

    expect(nextManager.state.players.playerA.hand).toContain(firstCopy)
    expect(nextManager.state.players.playerA.hand).not.toContain(selectedCopy)
    expect(nextManager.state.players.playerA.hand).toContain(thirdCopy)
    expect(nextManager.state.board.creatures.map(({ cardId }) => cardId)).toEqual([selectedCopy])
    expect(nextManager.state.players.playerA.hand).toHaveLength(4)
    expect(() => GameManager.summonCreature(nextManager, selectedCopy, 0)).toThrow(
      /is not in あなた's hand/,
    )
    expectCardsConserved(nextManager)
  })

  it('draws only enough cards to reach five on later keep-up phases', () => {
    let manager = createTestManager()
    const summonedCardId = manager.state.players.playerA.hand[0]
    manager = GameManager.summonCreature(manager, summonedCardId, 0)
    manager = GameManager.attackGroup(manager, 0, 0)

    expect(manager.state.activePlayerId).toBe('playerA')
    expect(manager.state.phase).toBe('battle')
    expect(manager.state.pendingCombat).toEqual({
      damageMarkers: [],
      destroyedCardIds: [],
      defendingPlayerId: 'playerB',
      playerWasHit: true,
      playerDamage: 1,
    })
    expect(manager.state.players.playerB.hand).toHaveLength(0)
    manager = GameManager.finishCombat(manager)

    expect(manager.state.activePlayerId).toBe('playerB')
    expect(manager.state.players.playerB.hand).toHaveLength(5)
    manager = passTurnWithoutAttack(manager)

    expect(manager.state.activePlayerId).toBe('playerA')
    expect(manager.state.players.playerA.hand).toHaveLength(5)
    expect(manager.state.players.playerA.deck).toHaveLength(42)
    expectCardsConserved(manager)
  })

  it('gives the second player one starting mana and three after their first keep-up', () => {
    let manager = createTestManager()

    expect(manager.state.players.playerA.mana).toBe(2)
    expect(manager.state.players.playerB.mana).toBe(1)

    manager = passTurnWithoutAttack(manager)

    expect(manager.state.activePlayerId).toBe('playerB')
    expect(manager.state.players.playerB.mana).toBe(3)
  })

  it('never grows either hand beyond five while turns advance', () => {
    let manager = createTestManager()

    for (let turn = 0; turn < 20; turn += 1) {
      manager = passTurnWithoutAttack(manager)
      expect(manager.state.players.playerA.hand.length).toBeLessThanOrEqual(5)
      expect(manager.state.players.playerB.hand.length).toBeLessThanOrEqual(5)
      expectCardsConserved(manager)
    }
  })

  it('moves destroyed cards from the board to their owner discard pile', () => {
    let manager = createTestManager()
    const playerACardId = manager.state.players.playerA.hand[0]
    manager = GameManager.summonCreature(manager, playerACardId, 0)
    manager = GameManager.attackGroup(manager, 0, 0)
    manager = GameManager.finishCombat(manager)

    const playerBCardId = manager.state.players.playerB.hand[0]
    manager = GameManager.summonCreature(manager, playerBCardId, 1)
    manager = GameManager.attackGroup(manager, 1, 1)

    expect(manager.state.pendingCombat?.damageMarkers).toEqual([
      { cardId: playerACardId, damage: 3 },
    ])
    expect(manager.state.pendingCombat?.destroyedCardIds).toEqual([playerACardId])
    expect(manager.state.pendingCombat?.playerWasHit).toBe(true)
    expect(manager.state.pendingCombat?.playerDamage).toBe(0)
    expect(manager.state.board.creatures.some(({ cardId }) => cardId === playerACardId)).toBe(true)
    expect(manager.state.players.playerA.discard).not.toContain(playerACardId)
    expect(() => GameManager.passPhase(manager)).toThrow(/finish resolving/)

    manager = GameManager.finishCombat(manager)

    expect(manager.state.board.creatures.some(({ cardId }) => cardId === playerACardId)).toBe(false)
    expect(manager.state.players.playerA.discard).toContain(playerACardId)
    expect(manager.state.players.playerA.hand).toHaveLength(5)
    expect(manager.state.pendingCombat).toBeNull()
    expectCardsConserved(manager)
  })

  it('allows one optional hand discard during each main phase', () => {
    let manager = createTestManager()
    const [discardedCardId, secondCardId] = manager.state.players.playerA.hand
    const initialDiscardActions = GameManager.getLegalMainActions(manager).filter(
      ({ type }) => type === 'discardFromHand',
    )

    expect(initialDiscardActions).toHaveLength(5)
    manager = GameManager.discardFromHand(manager, discardedCardId)

    expect(manager.state.players.playerA.hand).not.toContain(discardedCardId)
    expect(manager.state.players.playerA.discard).toContain(discardedCardId)
    expect(manager.state.hasDiscardedThisTurn).toBe(true)
    expect(
      GameManager.getLegalMainActions(manager).some(({ type }) => type === 'discardFromHand'),
    ).toBe(false)
    expect(() => GameManager.discardFromHand(manager, secondCardId)).toThrow(
      /Only one card/,
    )
    expectCardsConserved(manager)

    manager = GameManager.passPhase(manager)
    expect(() => GameManager.discardFromHand(manager, secondCardId)).toThrow(
      /main phase/,
    )
    manager = GameManager.passPhase(manager)
    manager = GameManager.passPhase(manager)

    expect(manager.state.activePlayerId).toBe('playerB')
    expect(manager.state.phase).toBe('main')
    expect(manager.state.hasDiscardedThisTurn).toBe(false)
    expect(
      GameManager.getLegalMainActions(manager).filter(
        ({ type }) => type === 'discardFromHand',
      ),
    ).toHaveLength(5)
  })

  it('rejects duplicate zones, orphaned cards, and a six-card hand', () => {
    const manager = createTestManager()
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

  it('shares the immutable card registry between internal state transitions', () => {
    const manager = createTestManager()
    const nextManager = GameManager.passPhase(manager)

    expect(nextManager.state.cards).toBe(manager.state.cards)
    expect(Object.isFrozen(manager.state.cards)).toBe(true)
    expect(Object.isFrozen(manager.state.cards[1])).toBe(true)
  })

  it('requires card instance ids to be consecutive from one', () => {
    const manager = createTestManager()
    const cardCount = Object.keys(manager.state.cards).length
    const cards = {
      ...manager.state.cards,
      [cardCount + 1]: {
        ...manager.state.cards[cardCount],
        id: cardCount + 1,
      },
    }
    delete cards[cardCount]

    expect(() => GameManager.from({ ...manager.state, cards })).toThrow(
      /consecutive ids starting at 1/,
    )
  })
})
