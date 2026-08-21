import { describe, expect, it } from 'vitest'
import { CARD_BY_DEFINITION_ID } from './cards'
import { GameManager } from './GameManager'
import { THEME_DECKS } from './themeDecks'

const KEEP_ORDER_RANDOM = () => 1 - Number.EPSILON

describe('theme decks', () => {
  it.each(THEME_DECKS)('$name contains the documented 40-card cost structure', (deck) => {
    const cards = deck.cardDefinitionIds.map((definitionId) => {
      const card = CARD_BY_DEFINITION_ID[definitionId]
      expect(card, definitionId).toBeDefined()
      return card
    })

    expect(cards).toHaveLength(40)
    expect(cards.filter((card) => card.kind === 'creature' && card.cost === 2)).toHaveLength(25)
    expect(cards.filter((card) => card.kind === 'creature' && card.cost === 4)).toHaveLength(9)
    expect(cards.filter((card) => card.kind === 'creature' && card.cost === 5)).toHaveLength(3)
    expect(cards.filter((card) => card.kind === 'spell')).toHaveLength(3)
    expect(cards.filter((card) => card.kind === 'spell' && card.cost === 0)).toHaveLength(3)
    expect(cards.filter((card) => card.kind === 'creature' && card.color === deck.colors[0])).toHaveLength(20)
    expect(cards.filter((card) => card.kind === 'creature' && card.color === deck.colors[1])).toHaveLength(17)
  })

  it('creates separate sequential card instances from the selected player and COM decks', () => {
    const playerDeck = THEME_DECKS[0]
    const comDeck = THEME_DECKS[2]
    const manager = GameManager.create(KEEP_ORDER_RANDOM, {
      playerA: playerDeck.cardDefinitionIds,
      playerB: comDeck.cardDefinitionIds,
    })
    const instances = Object.values(manager.state.cards)

    expect(instances).toHaveLength(80)
    expect(instances.map(({ id }) => id)).toEqual(
      Array.from({ length: 80 }, (_, index) => index + 1),
    )
    expect(manager.state.players.playerA.hand).toHaveLength(4)
    expect(manager.state.players.playerA.deck).toHaveLength(36)
    expect(manager.state.players.playerB.hand).toHaveLength(0)
    expect(manager.state.players.playerB.deck).toHaveLength(40)
    expect(instances.slice(0, 40).every(({ ownerId }) => ownerId === 'playerA')).toBe(true)
    expect(instances.slice(40).every(({ ownerId }) => ownerId === 'playerB')).toBe(true)
  })
})
