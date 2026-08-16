import { describe, expect, it } from 'vitest'
import { THEME_DECKS } from '../themeDecks'
import {
  DEFAULT_TOURNAMENT_GAMES_PER_SIDE,
  createRoundRobinSchedule,
  playAiMatch,
  summarizeTournament,
} from './tournament'

describe('AI tournament', () => {
  it('creates five games for both player orders of every deck pairing', () => {
    const schedule = createRoundRobinSchedule(THEME_DECKS)

    expect(schedule).toHaveLength(300)
    for (let firstIndex = 0; firstIndex < THEME_DECKS.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < THEME_DECKS.length; secondIndex += 1) {
        const firstDeckId = THEME_DECKS[firstIndex].id
        const secondDeckId = THEME_DECKS[secondIndex].id
        expect(
          schedule.filter(
            ({ playerADeckId, playerBDeckId }) =>
              playerADeckId === firstDeckId && playerBDeckId === secondDeckId,
          ),
        ).toHaveLength(DEFAULT_TOURNAMENT_GAMES_PER_SIDE)
        expect(
          schedule.filter(
            ({ playerADeckId, playerBDeckId }) =>
              playerADeckId === secondDeckId && playerBDeckId === firstDeckId,
          ),
        ).toHaveLength(DEFAULT_TOURNAMENT_GAMES_PER_SIDE)

        const firstOrderSeeds = schedule
          .filter(
            ({ playerADeckId, playerBDeckId }) =>
              playerADeckId === firstDeckId && playerBDeckId === secondDeckId,
          )
          .map(({ seed }) => seed)
        const secondOrderSeeds = schedule
          .filter(
            ({ playerADeckId, playerBDeckId }) =>
              playerADeckId === secondDeckId && playerBDeckId === firstDeckId,
          )
          .map(({ seed }) => seed)
        expect(secondOrderSeeds).toEqual(firstOrderSeeds)
      }
    }
  })

  it('stops an unresolved game at the simulation turn limit', () => {
    const result = playAiMatch({
      matchNumber: 1,
      gameNumber: 1,
      seed: 1,
      playerADeckId: THEME_DECKS[0].id,
      playerBDeckId: THEME_DECKS[1].id,
      playerADeck: THEME_DECKS[0],
      playerBDeck: THEME_DECKS[1],
      turnLimit: 1,
    })

    expect(result.termination).toBe('turnLimit')
    expect(result.winnerPlayerId).toBeNull()
    expect(result.turn).toBe(2)
    expect(result.actionCount).toBeGreaterThan(0)
  })

  it('summarizes wins, losses, and unresolved games by deck', () => {
    const [firstMatch, secondMatch] = createRoundRobinSchedule(THEME_DECKS, 1)
    const summary = summarizeTournament(THEME_DECKS, [
      {
        ...firstMatch,
        termination: 'victory',
        winnerPlayerId: 'playerA',
        winnerDeckId: firstMatch.playerADeckId,
        turn: 10,
        actionCount: 30,
        playerAHp: 4,
        playerBHp: 0,
      },
      {
        ...secondMatch,
        termination: 'turnLimit',
        winnerPlayerId: null,
        winnerDeckId: null,
        turn: 201,
        actionCount: 600,
        playerAHp: 10,
        playerBHp: 10,
      },
    ])

    expect(summary.totalMatches).toBe(2)
    expect(summary.decidedMatches).toBe(1)
    expect(summary.unresolvedMatches).toBe(1)
    expect(summary.playerAWins).toBe(1)
    expect(summary.deckRecords[0]).toMatchObject({ played: 2, wins: 1, unresolved: 1 })
    expect(summary.deckRecords[1]).toMatchObject({ played: 2, losses: 1, unresolved: 1 })
  })
})
