import { CARD_BY_DEFINITION_ID } from './cards'
import type { Card, CardInstance, CardInstanceId, PlayerId } from './types'

export type DeckSummary = {
  total: number
  creature: number
  formation: number
  spell: number
  red: number
  blue: number
  green: number
}

export const STANDARD_DECK_LIST = [
  'red-cost2-attack3-defense2-march1',
  'red-cost2-attack3-defense2-march1',
  'red-cost2-attack3-defense2-march1',
  'red-cost2-attack4-defense1-march1',
  'red-cost2-attack4-defense1-march1',
  'red-cost4-attack5-defense3-march2',
  'red-cost5-attack7-defense5-march2-vanish',
  'red-cost2-attack2-defense2-march1-lone-warrior-2-0',
  'red-cost2-attack2-defense2-march1-lone-warrior-2-0',
  'red-cost2-attack3-defense1-march1-withdraw',
  'red-cost2-attack3-defense1-march1-withdraw',
  'red-cost2-attack2-defense2-march1-assassin2',
  'red-cost2-attack2-defense2-march1-assassin2',
  'red-cost4-attack4-defense3-march2-lone-warrior-2-1',
  'red-cost4-attack5-defense2-march2-withdraw',
  'red-cost3-formation',

  'blue-cost2-attack2-defense2-march2',
  'blue-cost2-attack2-defense2-march2',
  'blue-cost2-attack2-defense2-march2',
  'blue-cost2-attack2-defense1-march3',
  'blue-cost2-attack2-defense1-march3',
  'blue-cost4-attack4-defense4-march3',
  'blue-cost5-attack5-defense6-march4-vanish',
  'blue-cost2-attack3-defense1-march1-counter',
  'blue-cost2-attack3-defense1-march1-counter',
  'blue-cost2-attack1-defense1-march2-return',
  'blue-cost2-attack1-defense1-march2-return',
  'blue-cost2-attack2-defense2-march1-beachhead1',
  'blue-cost2-attack2-defense2-march1-beachhead1',
  'blue-cost4-attack3-defense4-march2-counter',
  'blue-cost4-attack4-defense2-march2-return',
  'blue-cost3-formation',

  'green-cost2-attack2-defense3-march1',
  'green-cost2-attack2-defense3-march1',
  'green-cost2-attack2-defense3-march1',
  'green-cost2-attack1-defense4-march1',
  'green-cost2-attack1-defense4-march1',
  'green-cost4-attack4-defense6-march2',
  'green-cost5-attack6-defense7-march2-vanish',
  'green-cost2-attack1-defense3-march1-capture1',
  'green-cost2-attack1-defense3-march1-capture1',
  'green-cost2-attack2-defense2-march1-mining1',
  'green-cost2-attack2-defense2-march1-mining1',
  'green-cost2-attack2-defense2-march1-rearguard-0-2',
  'green-cost2-attack2-defense2-march1-rearguard-0-2',
  'green-cost4-attack2-defense5-march2-capture1',
  'green-cost4-attack3-defense4-march2-mining1',
  'green-cost3-formation',
] satisfies string[]

const getCardDefinition = (definitionId: string): Card => {
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
      if (card.kind === 'creature' || card.kind === 'formation') {
        summary[card.color] += 1
      }
      return summary
    },
    {
      total: 0,
      creature: 0,
      formation: 0,
      spell: 0,
      red: 0,
      blue: 0,
      green: 0,
    },
  )

export const createDeck = (
  definitionIds: readonly string[],
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
