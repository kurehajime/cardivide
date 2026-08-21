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
  'blue-green-intercept': { 2: 26, 4: 8, 5: 3 },
  'green-red-frontline': { 2: 25, 4: 9, 5: 3 },
} as const

const EXPECTED_CREATURE_COLORS_BY_DECK = {
  'red-blue-skirmish': { primary: 20, secondary: 17 },
  'blue-green-intercept': { primary: 20, secondary: 17 },
  'green-red-frontline': { primary: 19, secondary: 18 },
} as const

const BURNING_VANGUARD_ID = 'red-cost2-attack4-defense1-march0'
const DEEP_INTERCEPTOR_ID = 'blue-cost4-attack4-defense4-march2-counter'
const DEEP_WHALE_ID = 'blue-cost5-attack6-defense6-march4-vanish'
const MIST_RETURNER_ID = 'blue-cost2-attack2-defense1-march2-return'
const WAVE_RETURNER_ID = 'blue-cost4-attack4-defense2-march2-return'
const ROOTED_ANCIENT_ID = 'green-cost2-attack1-defense4-march0'
const GEODE_MINER_ID = 'green-cost2-attack2-defense2-march1-mining1'
const LEYLINE_MINER_ID = 'green-cost4-attack3-defense4-march1-mining1'

describe('theme decks', () => {
  it.each(THEME_DECKS)('$name contains the documented 40-card cost structure', (deck) => {
    const expectedCreatureCosts = EXPECTED_CREATURE_COSTS_BY_DECK[deck.id]
    const expectedCreatureColors = EXPECTED_CREATURE_COLORS_BY_DECK[deck.id]
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
    expect(
      cards.filter((card) => card.kind === 'creature' && card.color === deck.colors[0]),
    ).toHaveLength(expectedCreatureColors.primary)
    expect(
      cards.filter((card) => card.kind === 'creature' && card.color === deck.colors[1]),
    ).toHaveLength(expectedCreatureColors.secondary)
    expect(
      cards
        .filter((card) => card.kind === 'spell')
        .map((card) => card.definitionId),
    ).toEqual(EXPECTED_SPELLS_BY_DECK[deck.id])
  })

  it('gives 分断迎撃 one fewer 根張りの古木 and one more 夢渡りの森巨人', () => {
    const deck = THEME_DECKS.find(({ id }) => id === 'blue-green-intercept')!

    expect(CARD_BY_DEFINITION_ID[ROOTED_ANCIENT_ID]).toMatchObject({
      name: '根張りの古木',
      kind: 'creature',
      color: 'green',
      cost: 2,
      attack: 1,
      defense: 4,
      march: 0,
      abilities: [],
    })
    expect(
      deck.cardDefinitionIds.filter(
        (definitionId) => definitionId === ROOTED_ANCIENT_ID,
      ),
    ).toHaveLength(1)
    expect(
      deck.cardDefinitionIds.filter(
        (definitionId) => definitionId === 'green-cost5-attack6-defense7-march2-vanish',
      ),
    ).toHaveLength(2)
  })

  it('uses the current 燃え立つ先陣 in both red theme decks', () => {
    expect(CARD_BY_DEFINITION_ID[BURNING_VANGUARD_ID]).toMatchObject({
      name: '燃え立つ先陣',
      kind: 'creature',
      color: 'red',
      cost: 2,
      attack: 4,
      defense: 1,
      march: 0,
      abilities: [],
    })
    expect(
      THEME_DECKS.map((deck) =>
        deck.cardDefinitionIds.filter((definitionId) => definitionId === BURNING_VANGUARD_ID)
          .length,
      ),
    ).toEqual([2, 0, 3])
  })

  it('uses the current 深潮の迎撃者 in both blue theme decks', () => {
    expect(CARD_BY_DEFINITION_ID[DEEP_INTERCEPTOR_ID]).toMatchObject({
      name: '深潮の迎撃者',
      kind: 'creature',
      color: 'blue',
      cost: 4,
      attack: 4,
      defense: 4,
      march: 2,
      abilities: [{ type: 'counter' }],
    })
    expect(
      THEME_DECKS.map((deck) =>
        deck.cardDefinitionIds.filter((definitionId) => definitionId === DEEP_INTERCEPTOR_ID)
          .length,
      ),
    ).toEqual([1, 3, 0])
  })

  it('uses the strengthened 泡沫の深海鯨 in both blue theme decks', () => {
    expect(CARD_BY_DEFINITION_ID[DEEP_WHALE_ID]).toMatchObject({
      name: '泡沫の深海鯨',
      kind: 'creature',
      color: 'blue',
      cost: 5,
      attack: 6,
      defense: 6,
      march: 4,
      abilities: [{ type: 'vanish' }],
    })
    expect(
      THEME_DECKS.map((deck) =>
        deck.cardDefinitionIds.filter((definitionId) => definitionId === DEEP_WHALE_ID).length,
      ),
    ).toEqual([1, 1, 0])
  })

  it('moves 分断迎撃 mining toward the low-cost 晶洞の坑夫', () => {
    expect(CARD_BY_DEFINITION_ID[LEYLINE_MINER_ID]).toMatchObject({
      name: '地脈掘りの巨人',
      kind: 'creature',
      color: 'green',
      cost: 4,
      attack: 3,
      defense: 4,
      march: 1,
      abilities: [{ type: 'mining', mana: 1 }],
    })
    expect(
      THEME_DECKS.map((deck) =>
        deck.cardDefinitionIds.filter((definitionId) => definitionId === GEODE_MINER_ID).length,
      ),
    ).toEqual([0, 3, 2])
    expect(
      THEME_DECKS.map((deck) =>
        deck.cardDefinitionIds.filter((definitionId) => definitionId === LEYLINE_MINER_ID).length,
      ),
    ).toEqual([0, 0, 2])
  })

  it('moves 分断迎撃 return toward the low-cost 霧渡りの使者', () => {
    expect(
      THEME_DECKS.map((deck) =>
        deck.cardDefinitionIds.filter((definitionId) => definitionId === MIST_RETURNER_ID).length,
      ),
    ).toEqual([2, 3, 0])
    expect(
      THEME_DECKS.map((deck) =>
        deck.cardDefinitionIds.filter((definitionId) => definitionId === WAVE_RETURNER_ID).length,
      ),
    ).toEqual([2, 0, 0])
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
