import { describe, expect, it } from 'vitest'
import { CARD_BY_DEFINITION_ID, CARD_DEFINITION_IDS, CARD_LIST } from './cards'
import { GameManager } from './GameManager'
import { THEME_DECKS } from './themeDecks'

const KEEP_ORDER_RANDOM = () => 1 - Number.EPSILON
const CARD_ID = CARD_DEFINITION_IDS

const EXPECTED_SPELLS_BY_DECK = {
  'red-blue-skirmish': [
    CARD_ID.RETURN_FIRE,
    CARD_ID.RETURN_FIRE,
    CARD_ID.BUBBLE_WALL,
  ],
  'blue-green-intercept': [
    CARD_ID.BUBBLE_WALL,
    CARD_ID.BUBBLE_WALL,
    CARD_ID.BUBBLE_WALL,
    CARD_ID.ABUNDANCE,
  ],
  'green-red-frontline': [
    CARD_ID.ABUNDANCE,
    CARD_ID.RETURN_FIRE,
  ],
} as const

const EXPECTED_CREATURE_COSTS_BY_DECK = {
  'red-blue-skirmish': { 2: 25, 4: 9, 5: 3 },
  'blue-green-intercept': { 2: 23, 4: 10, 5: 3 },
  'green-red-frontline': { 2: 23, 4: 10, 5: 5 },
} as const

const EXPECTED_CREATURE_COLORS_BY_DECK = {
  'red-blue-skirmish': { primary: 23, secondary: 14 },
  'blue-green-intercept': { primary: 22, secondary: 14 },
  'green-red-frontline': { primary: 24, secondary: 14 },
} as const

const EXPECTED_CARD_COUNTS_BY_DECK = {
  'red-blue-skirmish': {
    [CARD_ID.SPARK_SWORDSMAN]: 3,
    [CARD_ID.BURNING_VANGUARD]: 3,
    [CARD_ID.SOLITARY_PEAK_SWORDSMAN]: 3,
    [CARD_ID.FORMATION_CLEARING_MERCENARY]: 3,
    [CARD_ID.CRIMSON_BLADE_INFILTRATOR]: 3,
    [CARD_ID.BEACON_HEAVY_CAVALRY]: 2,
    [CARD_ID.LONE_ARMY_GENERAL]: 2,
    [CARD_ID.ASH_DISMANTLER]: 2,
    [CARD_ID.EXHAUSTED_VOLCANO_DRAGON]: 2,
    [CARD_ID.RETURN_FIRE]: 2,
    [CARD_ID.TIDEWAY_SCOUT]: 3,
    [CARD_ID.SPRAY_HERALD]: 2,
    [CARD_ID.MIST_RETURNING_MESSENGER]: 2,
    [CARD_ID.TIDEFRONT_FORTIFIER]: 3,
    [CARD_ID.AZURE_WAVE_VOYAGER]: 2,
    [CARD_ID.WAVE_RETURN_MAGE]: 1,
    [CARD_ID.EPHEMERAL_DEEP_WHALE]: 1,
    [CARD_ID.BUBBLE_WALL]: 1,
  },
  'blue-green-intercept': {
    [CARD_ID.TIDEWAY_SCOUT]: 3,
    [CARD_ID.SPRAY_HERALD]: 3,
    [CARD_ID.SURGING_DUELIST]: 3,
    [CARD_ID.MIST_RETURNING_MESSENGER]: 2,
    [CARD_ID.TIDEFRONT_FORTIFIER]: 2,
    [CARD_ID.AZURE_WAVE_VOYAGER]: 3,
    [CARD_ID.DEEP_TIDE_INTERCEPTOR]: 3,
    [CARD_ID.WAVE_RETURN_MAGE]: 1,
    [CARD_ID.EPHEMERAL_DEEP_WHALE]: 2,
    [CARD_ID.BUBBLE_WALL]: 3,
    [CARD_ID.OAKBARK_SENTINEL]: 3,
    [CARD_ID.ROOTED_ANCIENT]: 1,
    [CARD_ID.VINE_SNARE_HUNTER]: 2,
    [CARD_ID.GEODE_MINER]: 2,
    [CARD_ID.ROOT_FORT_REARGUARD]: 2,
    [CARD_ID.GREAT_TREE_GUARDIAN]: 1,
    [CARD_ID.FOREST_CAGE_BEASTMASTER]: 2,
    [CARD_ID.DREAMWALKING_FOREST_GIANT]: 1,
    [CARD_ID.ABUNDANCE]: 1,
  },
  'green-red-frontline': {
    [CARD_ID.OAKBARK_SENTINEL]: 3,
    [CARD_ID.ROOTED_ANCIENT]: 3,
    [CARD_ID.VINE_SNARE_HUNTER]: 3,
    [CARD_ID.GEODE_MINER]: 2,
    [CARD_ID.ROOT_FORT_REARGUARD]: 3,
    [CARD_ID.GREAT_TREE_GUARDIAN]: 3,
    [CARD_ID.FOREST_CAGE_BEASTMASTER]: 2,
    [CARD_ID.LEYLINE_MINING_GIANT]: 2,
    [CARD_ID.DREAMWALKING_FOREST_GIANT]: 3,
    [CARD_ID.ABUNDANCE]: 1,
    [CARD_ID.SPARK_SWORDSMAN]: 3,
    [CARD_ID.BURNING_VANGUARD]: 1,
    [CARD_ID.FORMATION_CLEARING_MERCENARY]: 3,
    [CARD_ID.CRIMSON_BLADE_INFILTRATOR]: 2,
    [CARD_ID.BEACON_HEAVY_CAVALRY]: 2,
    [CARD_ID.ASH_DISMANTLER]: 1,
    [CARD_ID.EXHAUSTED_VOLCANO_DRAGON]: 2,
    [CARD_ID.RETURN_FIRE]: 1,
  },
} as const

describe('theme decks', () => {
  it.each(THEME_DECKS)('$name contains the documented 40-card cost structure', (deck) => {
    const expectedCreatureCosts = EXPECTED_CREATURE_COSTS_BY_DECK[deck.id]
    const expectedCreatureColors = EXPECTED_CREATURE_COLORS_BY_DECK[deck.id]
    const cards = deck.cardDefinitionIds.map((definitionId) => {
      const card = CARD_BY_DEFINITION_ID[definitionId]
      if (!card) {
        throw new Error(`Unknown card definition: ${definitionId}`)
      }
      return card
    })
    const cardCounts = Object.fromEntries(
      [...new Set(deck.cardDefinitionIds)].map((definitionId) => [
        definitionId,
        deck.cardDefinitionIds.filter((candidate) => candidate === definitionId).length,
      ]),
    )

    expect(cards).toHaveLength(40)
    expect(cardCounts).toEqual(EXPECTED_CARD_COUNTS_BY_DECK[deck.id])
    expect(cards.filter((card) => card.kind === 'creature' && card.cost === 2)).toHaveLength(
      expectedCreatureCosts[2],
    )
    expect(cards.filter((card) => card.kind === 'creature' && card.cost === 4)).toHaveLength(
      expectedCreatureCosts[4],
    )
    expect(cards.filter((card) => card.kind === 'creature' && card.cost === 5)).toHaveLength(
      expectedCreatureCosts[5],
    )
    expect(cards.filter((card) => card.kind === 'spell')).toHaveLength(
      EXPECTED_SPELLS_BY_DECK[deck.id].length,
    )
    expect(cards.filter((card) => card.kind === 'spell' && card.cost === 0)).toHaveLength(
      EXPECTED_SPELLS_BY_DECK[deck.id].length,
    )
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

  it('uses every current card definition across the three preset decks', () => {
    const usedDefinitionIds = new Set(
      THEME_DECKS.flatMap((deck) => deck.cardDefinitionIds),
    )

    expect(
      CARD_LIST.filter((card) => !usedDefinitionIds.has(card.definitionId)).map(
        (card) => card.name,
      ),
    ).toEqual([])
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
