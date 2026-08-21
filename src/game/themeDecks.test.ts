import { describe, expect, it } from 'vitest'
import { CARD_BY_DEFINITION_ID } from './cards'
import { GameManager } from './GameManager'
import { THEME_DECKS } from './themeDecks'

const KEEP_ORDER_RANDOM = () => 1 - Number.EPSILON

const EXPECTED_SPELLS_BY_DECK = {
  'red-blue-skirmish': [
    'cost0-spell-return-fire',
    'cost0-spell-return-fire',
    'cost0-spell-bubble-wall',
  ],
  'blue-green-intercept': [
    'cost0-spell-bubble-wall',
    'cost0-spell-abundance',
    'cost0-spell-abundance',
  ],
  'green-red-frontline': [
    'cost0-spell-abundance',
    'cost0-spell-abundance',
    'cost0-spell-return-fire',
  ],
} as const

const EXPECTED_CREATURE_COSTS_BY_DECK = {
  'red-blue-skirmish': { 2: 25, 4: 9, 5: 3 },
  'blue-green-intercept': { 2: 24, 4: 9, 5: 4 },
  'green-red-frontline': { 2: 25, 4: 9, 5: 3 },
} as const

describe('theme decks', () => {
  it.each(THEME_DECKS)('$name contains the documented 40-card cost structure', (deck) => {
    const expectedCreatureCosts = EXPECTED_CREATURE_COSTS_BY_DECK[deck.id]
    const cards = deck.cardDefinitionIds.map((definitionId) => {
      const card = CARD_BY_DEFINITION_ID[definitionId]
      expect(card, definitionId).toBeDefined()
      return card
    })

    expect(cards).toHaveLength(40)
    expect(cards.filter((card) => card.kind === 'creature' && card.cost === 2)).toHaveLength(
      expectedCreatureCosts[2],
    )
    expect(cards.filter((card) => card.kind === 'creature' && card.cost === 4)).toHaveLength(
      expectedCreatureCosts[4],
    )
    expect(cards.filter((card) => card.kind === 'creature' && card.cost === 5)).toHaveLength(
      expectedCreatureCosts[5],
    )
    expect(cards.filter((card) => card.kind === 'spell')).toHaveLength(3)
    expect(cards.filter((card) => card.kind === 'spell' && card.cost === 0)).toHaveLength(3)
    expect(cards.filter((card) => card.kind === 'creature' && card.color === deck.colors[0])).toHaveLength(20)
    expect(cards.filter((card) => card.kind === 'creature' && card.color === deck.colors[1])).toHaveLength(17)
    expect(
      cards
        .filter((card) => card.kind === 'spell')
        .map((card) => card.definitionId),
    ).toEqual(EXPECTED_SPELLS_BY_DECK[deck.id])
  })

  it('gives 分断迎撃 one fewer 根張りの古木 and one more 夢渡りの森巨人', () => {
    const deck = THEME_DECKS.find(({ id }) => id === 'blue-green-intercept')!

    expect(
      deck.cardDefinitionIds.filter(
        (definitionId) => definitionId === 'green-cost2-attack2-defense4-march0',
      ),
    ).toHaveLength(1)
    expect(
      deck.cardDefinitionIds.filter(
        (definitionId) => definitionId === 'green-cost5-attack6-defense7-march2-vanish',
      ),
    ).toHaveLength(2)
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
