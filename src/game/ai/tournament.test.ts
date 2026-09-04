import { describe, expect, it } from 'vitest'
import { THEME_DECKS } from '../themeDecks'
import { CARD_DEFINITION_IDS } from '../cards'
import {
  DEFAULT_TOURNAMENT_GAMES_PER_SIDE,
  createExpansionCardSchedule,
  createDeckMatchupWinRateTable,
  createRoundRobinSchedule,
  playAiMatch,
  summarizeExpansionTournament,
  summarizeTournament,
} from './tournament'
import type { ExpansionAiMatchResult } from './tournament'

describe('AI tournament', () => {
  it('creates the configured number of games for both player orders of every deck pairing', () => {
    const schedule = createRoundRobinSchedule(THEME_DECKS)
    const pairingCount = (THEME_DECKS.length * (THEME_DECKS.length - 1)) / 2

    expect(schedule).toHaveLength(
      pairingCount * 2 * DEFAULT_TOURNAMENT_GAMES_PER_SIDE,
    )
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

  it('creates 900 paired expansion games with each deck expanded equally in both seats', () => {
    const schedule = createExpansionCardSchedule(
      THEME_DECKS,
      CARD_DEFINITION_IDS.MEPHISTOPHELES,
      2,
    )

    expect(schedule).toHaveLength(900)
    for (let index = 0; index < schedule.length; index += 2) {
      const first = schedule[index]
      const second = schedule[index + 1]
      expect(second).toMatchObject({
        comparisonNumber: first.comparisonNumber,
        gameNumber: first.gameNumber,
        seed: first.seed,
        playerADeckId: first.playerADeckId,
        playerBDeckId: first.playerBDeckId,
        expansionCardDefinitionId: first.expansionCardDefinitionId,
        expansionCardCount: first.expansionCardCount,
      })
      expect([first.expansionPlayerId, second.expansionPlayerId]).toEqual([
        'playerA',
        'playerB',
      ])
    }

    THEME_DECKS.forEach((deck) => {
      const expandedGames = schedule.filter((match) =>
        match.expansionPlayerId === 'playerA'
          ? match.playerADeckId === deck.id
          : match.playerBDeckId === deck.id,
      )
      expect(expandedGames).toHaveLength(150)
      expect(
        expandedGames.filter(({ expansionPlayerId }) => expansionPlayerId === 'playerA'),
      ).toHaveLength(75)
      expect(
        expandedGames.filter(({ expansionPlayerId }) => expansionPlayerId === 'playerB'),
      ).toHaveLength(75)
    })
  })

  it('summarizes favorable and unfavorable paired expansion results', () => {
    const [firstExpandedA, firstExpandedB, secondExpandedA, secondExpandedB] =
      createExpansionCardSchedule(
        THEME_DECKS,
        CARD_DEFINITION_IDS.MEPHISTOPHELES,
        2,
        2,
      )
    const result = (
      match: typeof firstExpandedA,
      winnerPlayerId: 'playerA' | 'playerB',
    ): ExpansionAiMatchResult => ({
      ...match,
      expansionDeckId:
        match.expansionPlayerId === 'playerA'
          ? match.playerADeckId
          : match.playerBDeckId,
      termination: 'victory',
      winnerPlayerId,
      winnerDeckId:
        winnerPlayerId === 'playerA'
          ? match.playerADeckId
          : match.playerBDeckId,
      turn: 10,
      actionCount: 30,
      playerAHp: winnerPlayerId === 'playerA' ? 5 : 0,
      playerBHp: winnerPlayerId === 'playerB' ? 5 : 0,
    })
    const summary = summarizeExpansionTournament(THEME_DECKS, [
      result(firstExpandedA, firstExpandedA.expansionPlayerId),
      result(firstExpandedB, firstExpandedB.expansionPlayerId),
      result(
        secondExpandedA,
        secondExpandedA.expansionPlayerId === 'playerA' ? 'playerB' : 'playerA',
      ),
      result(
        secondExpandedB,
        secondExpandedB.expansionPlayerId === 'playerA' ? 'playerB' : 'playerA',
      ),
    ])

    expect(summary).toMatchObject({
      totalMatches: 4,
      expansionWins: 2,
      baseWins: 2,
      favorableComparisons: 1,
      unfavorableComparisons: 1,
      splitComparisons: 0,
      unresolvedComparisons: 0,
    })
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

  it('creates a symmetric deck matchup win rate table and excludes unresolved games', () => {
    const decks = THEME_DECKS.slice(0, 3)
    const [ab, ba, ac, ca, bc, cb] = createRoundRobinSchedule(decks, 1)
    const victory = (
      match: typeof ab,
      winnerPlayerId: 'playerA' | 'playerB',
    ) => ({
      ...match,
      termination: 'victory' as const,
      winnerPlayerId,
      winnerDeckId:
        winnerPlayerId === 'playerA'
          ? match.playerADeckId
          : match.playerBDeckId,
      turn: 10,
      actionCount: 30,
      playerAHp: winnerPlayerId === 'playerA' ? 5 : 0,
      playerBHp: winnerPlayerId === 'playerB' ? 5 : 0,
    })
    const unresolved = {
      ...ac,
      termination: 'turnLimit' as const,
      winnerPlayerId: null,
      winnerDeckId: null,
      turn: 201,
      actionCount: 600,
      playerAHp: 10,
      playerBHp: 10,
    }

    const table = createDeckMatchupWinRateTable(decks, [
      victory(ab, 'playerA'),
      victory(ab, 'playerA'),
      victory(ba, 'playerA'),
      unresolved,
      victory(ca, 'playerA'),
      victory(bc, 'playerA'),
      victory(cb, 'playerA'),
    ])

    expect(table).toEqual({
      [decks[0].id]: {
        [decks[1].id]: 0.6667,
        [decks[2].id]: 0,
      },
      [decks[1].id]: {
        [decks[0].id]: 0.3333,
        [decks[2].id]: 0.5,
      },
      [decks[2].id]: {
        [decks[0].id]: 1,
        [decks[1].id]: 0.5,
      },
    })
  })
})
