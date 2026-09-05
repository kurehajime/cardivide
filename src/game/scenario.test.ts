import { describe, expect, it } from 'vitest'
import matchupWinRates from './ai/deck-matchup-win-rates.json'
import {
  addScenarioReward,
  getScenarioRewardChoices,
  getScenarioOpponentDeckIds,
  resolveScenarioBattle,
} from './scenario'
import { EXPANSION_CARD_DEFINITION_IDS } from './cards'
import { GameManager, assertValidGameState } from './GameManager'
import { THEME_DECKS, type ThemeDeckId } from './themeDecks'

const winRates = matchupWinRates as Record<
  ThemeDeckId,
  Partial<Record<ThemeDeckId, number | null>>
>

describe('scenario battles', () => {
  it.each(THEME_DECKS)('$name receives every other deck once in descending win-rate order', (deck) => {
    const opponents = getScenarioOpponentDeckIds(deck.id)
    const rates = opponents.map((opponentId) => winRates[deck.id][opponentId])

    expect(opponents).toHaveLength(THEME_DECKS.length - 1)
    expect(new Set(opponents).size).toBe(opponents.length)
    expect(opponents).not.toContain(deck.id)
    expect(rates.every((rate) => rate !== undefined && rate !== null)).toBe(true)
    for (let index = 1; index < rates.length; index += 1) {
      expect(rates[index - 1]!).toBeGreaterThanOrEqual(rates[index]!)
    }
  })

  it('advances only after a win and completes after the fifth battle', () => {
    expect(resolveScenarioBattle(0, 5, true)).toEqual({
      type: 'advance',
      nextBattleIndex: 1,
    })
    expect(resolveScenarioBattle(2, 5, false)).toEqual({ type: 'failed' })
    expect(resolveScenarioBattle(4, 5, true)).toEqual({ type: 'complete' })
  })

  it('offers three different expansion cards and randomizes the offer', () => {
    const deck = THEME_DECKS[0].cardDefinitionIds
    const first = getScenarioRewardChoices(deck, () => 0)
    const second = getScenarioRewardChoices(deck, () => 0.999)
    expect(first).toHaveLength(3)
    expect(new Set(first).size).toBe(3)
    expect(first.every((id) => EXPANSION_CARD_DEFINITION_IDS.some((candidate) => candidate === id))).toBe(true)
    expect(first).not.toEqual(second)
  })

  it('retains two-copy rewards in later battles and excludes a card at four copies', () => {
    const baseDeck = THEME_DECKS[0].cardDefinitionIds
    const reward = EXPANSION_CARD_DEFINITION_IDS[0]
    const otherReward = EXPANSION_CARD_DEFINITION_IDS[1]
    const afterFirst = addScenarioReward(baseDeck, reward)
    expect(afterFirst.filter((id) => id === reward)).toHaveLength(2)
    expect(getScenarioRewardChoices(afterFirst, () => 0.999)).toContain(reward)
    const afterSecond = addScenarioReward(afterFirst, reward)
    expect(afterSecond.filter((id) => id === reward)).toHaveLength(4)
    expect(getScenarioRewardChoices(afterSecond, () => 0.999)).not.toContain(reward)
    expect(() => addScenarioReward(afterSecond, reward)).toThrow()
    const afterThird = addScenarioReward(afterSecond, otherReward)
    const manager = GameManager.create(() => 0.999, {
      playerA: afterThird,
      playerB: THEME_DECKS[1].cardDefinitionIds,
    })
    const ownCards = Object.values(manager.state.cards).filter((card) => card.ownerId === 'playerA')
    expect(ownCards).toHaveLength(46)
    expect(ownCards.filter(({ card }) => card.definitionId === reward)).toHaveLength(4)
    expect(ownCards.filter(({ card }) => card.definitionId === otherReward)).toHaveLength(2)
    expect(new Set(ownCards.map(({ id }) => id)).size).toBe(46)
    expect(baseDeck).toHaveLength(40)
    expect(afterFirst).toHaveLength(42)
    expect(() => assertValidGameState(manager.state)).not.toThrow()
  })

  it('offers fewer cards when fewer remain and permits continuing when all are capped', () => {
    const baseDeck = THEME_DECKS[0].cardDefinitionIds
    const capped = EXPANSION_CARD_DEFINITION_IDS.flatMap((id) => [id, id, id, id])
    const almostCapped = [...baseDeck, ...capped.slice(4)]
    expect(getScenarioRewardChoices(almostCapped)).toEqual([EXPANSION_CARD_DEFINITION_IDS[0]])
    const allCapped = [...baseDeck, ...capped]
    expect(getScenarioRewardChoices(allCapped)).toEqual([])
    expect(addScenarioReward(allCapped)).toEqual(allCapped)
    expect(() => addScenarioReward(baseDeck)).toThrow()
    expect(() => addScenarioReward(baseDeck, baseDeck[0])).toThrow()
  })
})
