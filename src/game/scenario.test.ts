import { describe, expect, it } from 'vitest'
import matchupWinRates from './ai/deck-matchup-win-rates.json'
import { getScenarioOpponentDeckIds, resolveScenarioBattle } from './scenario'
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
})
