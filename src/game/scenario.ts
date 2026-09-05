import matchupWinRates from './ai/deck-matchup-win-rates.json'
import { EXPANSION_CARD_DEFINITION_IDS } from './cards'
import { THEME_DECK_BY_ID, THEME_DECKS } from './themeDecks'
import type { ThemeDeckId } from './themeDecks'
import type { CardDefinitionId } from './types'

const REWARD_COPIES = 2
const MAX_REWARD_COPIES = 4

const getEligibleRewards = (deck: readonly CardDefinitionId[]): CardDefinitionId[] =>
  EXPANSION_CARD_DEFINITION_IDS.filter((id) =>
    deck.filter((cardId) => cardId === id).length + REWARD_COPIES <= MAX_REWARD_COPIES,
  )

export const getScenarioRewardChoices = (
  deck: readonly CardDefinitionId[],
  random: () => number = Math.random,
): CardDefinitionId[] => {
  const candidates = getEligibleRewards(deck)
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]]
  }
  return candidates.slice(0, 3)
}

export const addScenarioReward = (
  deck: readonly CardDefinitionId[],
  rewardId?: CardDefinitionId,
): CardDefinitionId[] => {
  const eligible = getEligibleRewards(deck)
  if (rewardId === undefined && eligible.length === 0) {
    return [...deck]
  }
  if (rewardId === undefined || !eligible.includes(rewardId)) {
    throw new Error('Choose an eligible scenario reward.')
  }
  return [...deck, ...Array<CardDefinitionId>(REWARD_COPIES).fill(rewardId)]
}

const MAX_SCENARIO_BATTLES = 5
const winRates = matchupWinRates as Record<
  ThemeDeckId,
  Partial<Record<ThemeDeckId, number | null>>
>

export const getScenarioOpponentDeckIds = (
  playerDeckId: ThemeDeckId,
): ThemeDeckId[] => {
  if (!THEME_DECK_BY_ID[playerDeckId]) {
    throw new Error('Unknown player deck ID.')
  }

  const playerWinRates = winRates[playerDeckId]
  if (!playerWinRates) {
    throw new Error('Scenario win rates are missing for the selected deck.')
  }

  return THEME_DECKS
    .map((deck, sourceIndex) => ({
      deck,
      sourceIndex,
      winRate: playerWinRates[deck.id] ?? null,
    }))
    .filter(({ deck }) => deck.id !== playerDeckId)
    .sort((first, second) => {
      if (first.winRate === null && second.winRate === null) {
        return first.sourceIndex - second.sourceIndex
      }
      if (first.winRate === null) {
        return 1
      }
      if (second.winRate === null) {
        return -1
      }
      return second.winRate - first.winRate || first.sourceIndex - second.sourceIndex
    })
    .slice(0, MAX_SCENARIO_BATTLES)
    .map(({ deck }) => deck.id)
}

export type ScenarioBattleResolution =
  | { type: 'advance'; nextBattleIndex: number }
  | { type: 'complete' }
  | { type: 'failed' }

export const resolveScenarioBattle = (
  currentBattleIndex: number,
  totalBattles: number,
  playerWon: boolean,
): ScenarioBattleResolution => {
  if (
    !Number.isInteger(currentBattleIndex) ||
    !Number.isInteger(totalBattles) ||
    currentBattleIndex < 0 ||
    totalBattles <= 0 ||
    currentBattleIndex >= totalBattles
  ) {
    throw new Error('Scenario battle progress is invalid.')
  }
  if (!playerWon) {
    return { type: 'failed' }
  }

  const nextBattleIndex = currentBattleIndex + 1
  return nextBattleIndex < totalBattles
    ? { type: 'advance', nextBattleIndex }
    : { type: 'complete' }
}
