import { CARD_BY_DEFINITION_ID, CARD_DEFINITION_IDS } from './cards'
import type {
  Card,
  CardDefinitionId,
  CardInstance,
  CardInstanceId,
  PlayerId,
} from './types'

const CARD_ID = CARD_DEFINITION_IDS

export type DeckSummary = {
  total: number
  creature: number
  spell: number
  red: number
  blue: number
  green: number
}

export const STANDARD_DECK_LIST = [
  CARD_ID.SPARK_SWORDSMAN,
  CARD_ID.SPARK_SWORDSMAN,
  CARD_ID.SPARK_SWORDSMAN,
  CARD_ID.BURNING_VANGUARD,
  CARD_ID.BURNING_VANGUARD,
  CARD_ID.BEACON_HEAVY_CAVALRY,
  CARD_ID.EXHAUSTED_VOLCANO_DRAGON,
  CARD_ID.SOLITARY_PEAK_SWORDSMAN,
  CARD_ID.SOLITARY_PEAK_SWORDSMAN,
  CARD_ID.FORMATION_CLEARING_MERCENARY,
  CARD_ID.FORMATION_CLEARING_MERCENARY,
  CARD_ID.CRIMSON_BLADE_INFILTRATOR,
  CARD_ID.CRIMSON_BLADE_INFILTRATOR,
  CARD_ID.LONE_ARMY_GENERAL,
  CARD_ID.ASH_DISMANTLER,
  CARD_ID.RETURN_FIRE,

  CARD_ID.TIDEWAY_SCOUT,
  CARD_ID.TIDEWAY_SCOUT,
  CARD_ID.TIDEWAY_SCOUT,
  CARD_ID.SPRAY_HERALD,
  CARD_ID.SPRAY_HERALD,
  CARD_ID.AZURE_WAVE_VOYAGER,
  CARD_ID.EPHEMERAL_DEEP_WHALE,
  CARD_ID.SURGING_DUELIST,
  CARD_ID.SURGING_DUELIST,
  CARD_ID.MIST_RETURNING_MESSENGER,
  CARD_ID.MIST_RETURNING_MESSENGER,
  CARD_ID.TIDEFRONT_FORTIFIER,
  CARD_ID.TIDEFRONT_FORTIFIER,
  CARD_ID.DEEP_TIDE_INTERCEPTOR,
  CARD_ID.WAVE_RETURN_MAGE,
  CARD_ID.LIFE_DROPLET,

  CARD_ID.OAKBARK_SENTINEL,
  CARD_ID.OAKBARK_SENTINEL,
  CARD_ID.OAKBARK_SENTINEL,
  CARD_ID.ROOTED_ANCIENT,
  CARD_ID.ROOTED_ANCIENT,
  CARD_ID.GREAT_TREE_GUARDIAN,
  CARD_ID.DREAMWALKING_FOREST_GIANT,
  CARD_ID.VINE_SNARE_HUNTER,
  CARD_ID.VINE_SNARE_HUNTER,
  CARD_ID.GEODE_MINER,
  CARD_ID.GEODE_MINER,
  CARD_ID.ROOT_FORT_REARGUARD,
  CARD_ID.ROOT_FORT_REARGUARD,
  CARD_ID.FOREST_CAGE_BEASTMASTER,
  CARD_ID.LEYLINE_MINING_GIANT,
  CARD_ID.ABUNDANCE,
] satisfies CardDefinitionId[]

const getCardDefinition = (definitionId: CardDefinitionId): Card => {
  const card = CARD_BY_DEFINITION_ID[definitionId]
  if (!card) {
    throw new Error(`Unknown card definition: ${definitionId}`)
  }
  return card
}

const summarizeDeck = (deck: CardInstance[]): DeckSummary =>
  deck.reduce<DeckSummary>(
    (summary, instance) => {
      const { card } = instance
      summary.total += 1
      summary[card.kind] += 1
      if (card.kind === 'creature') {
        summary[card.color] += 1
      }
      return summary
    },
    {
      total: 0,
      creature: 0,
      spell: 0,
      red: 0,
      blue: 0,
      green: 0,
    },
  )

export const createDeck = (
  definitionIds: readonly CardDefinitionId[],
  ownerId: PlayerId,
  firstCardId: CardInstanceId,
): CardInstance[] =>
  definitionIds.map((definitionId, index) => ({
    id: firstCardId + index,
    ownerId,
    card: getCardDefinition(definitionId),
  }))

export const createStandardDeck = (
  ownerId: PlayerId,
  firstCardId: CardInstanceId,
): CardInstance[] => createDeck(STANDARD_DECK_LIST, ownerId, firstCardId)

export const STANDARD_DECK = createStandardDeck('playerA', 1)

export const STANDARD_DECK_SUMMARY = summarizeDeck(STANDARD_DECK)
