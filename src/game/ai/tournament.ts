import { GameManager } from '../GameManager'
import { PLAYER_IDS } from '../types'
import type { CardDefinitionId, PlayerId } from '../types'
import type { ThemeDeck, ThemeDeckId } from '../themeDecks'
import { GameAI } from './GameAI'

export const DEFAULT_TOURNAMENT_GAMES_PER_SIDE = 30
export const DEFAULT_TOURNAMENT_SEED = 20260816
export const DEFAULT_MATCH_TURN_LIMIT = 200

const MAX_ACTIONS_PER_MATCH = 10_000
const KEEP_ORDER_RANDOM = () => 1 - Number.EPSILON
const WIN_RATE_DECIMAL_PLACES = 4

export type TournamentMatch = {
  matchNumber: number
  gameNumber: number
  seed: number
  playerADeckId: ThemeDeckId
  playerBDeckId: ThemeDeckId
}

export type ExpansionTournamentMatch = TournamentMatch & {
  comparisonNumber: number
  expansionPlayerId: PlayerId
  expansionCardDefinitionId: CardDefinitionId
  expansionCardCount: number
}

export type MatchTermination = 'victory' | 'turnLimit' | 'actionLimit'

export type AiMatchResult = TournamentMatch & {
  termination: MatchTermination
  winnerPlayerId: PlayerId | null
  winnerDeckId: ThemeDeckId | null
  turn: number
  actionCount: number
  playerAHp: number
  playerBHp: number
}

export type ExpansionAiMatchResult = AiMatchResult & {
  comparisonNumber: number
  expansionPlayerId: PlayerId
  expansionDeckId: ThemeDeckId
  expansionCardDefinitionId: CardDefinitionId
  expansionCardCount: number
}

export type DeckTournamentRecord = {
  deckId: ThemeDeckId
  played: number
  wins: number
  losses: number
  unresolved: number
  playerAWins: number
  playerBWins: number
}

export type TournamentSummary = {
  totalMatches: number
  decidedMatches: number
  unresolvedMatches: number
  playerAWins: number
  playerBWins: number
  deckRecords: DeckTournamentRecord[]
}

export type ExpansionDeckTournamentRecord = {
  deckId: ThemeDeckId
  played: number
  wins: number
  losses: number
  unresolved: number
  playerAPlayed: number
  playerAWins: number
  playerBPlayed: number
  playerBWins: number
}

export type ExpansionTournamentSummary = {
  totalMatches: number
  decidedMatches: number
  expansionWins: number
  baseWins: number
  unresolvedMatches: number
  favorableComparisons: number
  unfavorableComparisons: number
  splitComparisons: number
  unresolvedComparisons: number
  deckRecords: ExpansionDeckTournamentRecord[]
}

export type DeckMatchupWinRateTable = Record<
  string,
  Record<string, number | null>
>

type PlayAiMatchOptions = TournamentMatch & {
  playerADeck: ThemeDeck
  playerBDeck: ThemeDeck
  turnLimit?: number
}

type RunRoundRobinOptions = {
  decks: readonly ThemeDeck[]
  gamesPerSide?: number
  baseSeed?: number
  turnLimit?: number
  onMatchComplete?: (result: AiMatchResult) => void
}

type RunExpansionCardTournamentOptions = {
  decks: readonly ThemeDeck[]
  expansionCardDefinitionId: CardDefinitionId
  expansionCardCount: number
  gamesPerSide?: number
  baseSeed?: number
  turnLimit?: number
  onMatchComplete?: (result: ExpansionAiMatchResult) => void
}

const createSeededRandom = (seed: number): (() => number) => {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

const shuffleDeck = (deck: ThemeDeck, seed: number): CardDefinitionId[] => {
  const shuffled = [...deck.cardDefinitionIds]
  const random = createSeededRandom(seed ^ deck.tournamentShuffleSalt)

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
      ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }

  return shuffled
}

export const createRoundRobinSchedule = (
  decks: readonly ThemeDeck[],
  gamesPerSide = DEFAULT_TOURNAMENT_GAMES_PER_SIDE,
  baseSeed = DEFAULT_TOURNAMENT_SEED,
): TournamentMatch[] => {
  if (!Number.isInteger(gamesPerSide) || gamesPerSide <= 0) {
    throw new Error('gamesPerSide must be a positive integer.')
  }

  const schedule: TournamentMatch[] = []
  let matchNumber = 1
  let pairingNumber = 0

  for (let firstIndex = 0; firstIndex < decks.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < decks.length; secondIndex += 1) {
      const firstDeck = decks[firstIndex]
      const secondDeck = decks[secondIndex]
      const pairingSeed = baseSeed + pairingNumber * gamesPerSide

      for (const [playerADeck, playerBDeck] of [
        [firstDeck, secondDeck],
        [secondDeck, firstDeck],
      ] as const) {
        for (let gameIndex = 0; gameIndex < gamesPerSide; gameIndex += 1) {
          schedule.push({
            matchNumber,
            gameNumber: gameIndex + 1,
            seed: pairingSeed + gameIndex,
            playerADeckId: playerADeck.id,
            playerBDeckId: playerBDeck.id,
          })
          matchNumber += 1
        }
      }
      pairingNumber += 1
    }
  }

  return schedule
}

export const createExpansionCardSchedule = (
  decks: readonly ThemeDeck[],
  expansionCardDefinitionId: CardDefinitionId,
  expansionCardCount: number,
  gamesPerSide = DEFAULT_TOURNAMENT_GAMES_PER_SIDE,
  baseSeed = DEFAULT_TOURNAMENT_SEED,
): ExpansionTournamentMatch[] => {
  if (!Number.isInteger(expansionCardCount) || expansionCardCount <= 0) {
    throw new Error('expansionCardCount must be a positive integer.')
  }
  if (
    !Number.isInteger(gamesPerSide) ||
    gamesPerSide <= 0 ||
    gamesPerSide % 2 !== 0
  ) {
    throw new Error('gamesPerSide must be a positive even integer.')
  }

  const schedule: ExpansionTournamentMatch[] = []
  const comparisonGamesPerSide = gamesPerSide / 2
  let matchNumber = 1
  let comparisonNumber = 1
  let pairingNumber = 0

  for (let firstIndex = 0; firstIndex < decks.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < decks.length; secondIndex += 1) {
      const firstDeck = decks[firstIndex]
      const secondDeck = decks[secondIndex]
      const pairingSeed = baseSeed + pairingNumber * gamesPerSide

      for (const [playerADeck, playerBDeck] of [
        [firstDeck, secondDeck],
        [secondDeck, firstDeck],
      ] as const) {
        for (let gameIndex = 0; gameIndex < comparisonGamesPerSide; gameIndex += 1) {
          for (const expansionPlayerId of PLAYER_IDS) {
            schedule.push({
              matchNumber,
              comparisonNumber,
              gameNumber: gameIndex + 1,
              seed: pairingSeed + gameIndex,
              playerADeckId: playerADeck.id,
              playerBDeckId: playerBDeck.id,
              expansionPlayerId,
              expansionCardDefinitionId,
              expansionCardCount,
            })
            matchNumber += 1
          }
          comparisonNumber += 1
        }
      }
      pairingNumber += 1
    }
  }

  return schedule
}

export const playAiMatch = ({
  playerADeck,
  playerBDeck,
  turnLimit = DEFAULT_MATCH_TURN_LIMIT,
  ...match
}: PlayAiMatchOptions): AiMatchResult => {
  let manager = GameManager.create(KEEP_ORDER_RANDOM, {
    playerA: shuffleDeck(playerADeck, match.seed),
    playerB: shuffleDeck(playerBDeck, match.seed),
  })
  const ai = new GameAI()
  let actionCount = 0

  const createResult = (
    termination: MatchTermination,
    winnerPlayerId: PlayerId | null,
  ): AiMatchResult => ({
    ...match,
    termination,
    winnerPlayerId,
    winnerDeckId:
      winnerPlayerId === 'playerA'
        ? playerADeck.id
        : winnerPlayerId === 'playerB'
          ? playerBDeck.id
          : null,
    turn: manager.state.turn,
    actionCount,
    playerAHp: manager.state.players.playerA.hp,
    playerBHp: manager.state.players.playerB.hp,
  })

  while (true) {
    const winnerPlayerId = GameManager.getWinner(manager)
    if (winnerPlayerId !== null) {
      return createResult('victory', winnerPlayerId)
    }
    if (manager.state.turn > turnLimit) {
      return createResult('turnLimit', null)
    }
    if (actionCount >= MAX_ACTIONS_PER_MATCH) {
      return createResult('actionLimit', null)
    }

    const action = ai.chooseAction(manager)
    if (action === null) {
      throw new Error('AI returned no action before the game ended.')
    }
    manager = GameManager.applyAction(manager, action)
    actionCount += 1
  }
}

export const runRoundRobinTournament = ({
  decks,
  gamesPerSide = DEFAULT_TOURNAMENT_GAMES_PER_SIDE,
  baseSeed = DEFAULT_TOURNAMENT_SEED,
  turnLimit = DEFAULT_MATCH_TURN_LIMIT,
  onMatchComplete,
}: RunRoundRobinOptions): AiMatchResult[] => {
  const deckById = new Map(decks.map((deck) => [deck.id, deck]))

  return createRoundRobinSchedule(decks, gamesPerSide, baseSeed).map((match) => {
    const playerADeck = deckById.get(match.playerADeckId)
    const playerBDeck = deckById.get(match.playerBDeckId)
    if (!playerADeck || !playerBDeck) {
      throw new Error('Tournament schedule references an unknown deck.')
    }

    const result = playAiMatch({
      ...match,
      playerADeck,
      playerBDeck,
      turnLimit,
    })
    onMatchComplete?.(result)
    return result
  })
}

export const runExpansionCardTournament = ({
  decks,
  expansionCardDefinitionId,
  expansionCardCount,
  gamesPerSide = DEFAULT_TOURNAMENT_GAMES_PER_SIDE,
  baseSeed = DEFAULT_TOURNAMENT_SEED,
  turnLimit = DEFAULT_MATCH_TURN_LIMIT,
  onMatchComplete,
}: RunExpansionCardTournamentOptions): ExpansionAiMatchResult[] => {
  const deckById = new Map(decks.map((deck) => [deck.id, deck]))
  const expansionCopies = Array.from(
    { length: expansionCardCount },
    () => expansionCardDefinitionId,
  )

  return createExpansionCardSchedule(
    decks,
    expansionCardDefinitionId,
    expansionCardCount,
    gamesPerSide,
    baseSeed,
  ).map((match) => {
    const {
      comparisonNumber,
      expansionPlayerId,
      expansionCardDefinitionId: cardDefinitionId,
      expansionCardCount: cardCount,
      ...tournamentMatch
    } = match
    const basePlayerADeck = deckById.get(match.playerADeckId)
    const basePlayerBDeck = deckById.get(match.playerBDeckId)
    if (!basePlayerADeck || !basePlayerBDeck) {
      throw new Error('Expansion tournament schedule references an unknown deck.')
    }
    const withExpansion = (deck: ThemeDeck): ThemeDeck => ({
      ...deck,
      cardDefinitionIds: [...deck.cardDefinitionIds, ...expansionCopies],
    })
    const playerADeck =
      expansionPlayerId === 'playerA'
        ? withExpansion(basePlayerADeck)
        : basePlayerADeck
    const playerBDeck =
      expansionPlayerId === 'playerB'
        ? withExpansion(basePlayerBDeck)
        : basePlayerBDeck
    const result = playAiMatch({
      ...tournamentMatch,
      playerADeck,
      playerBDeck,
      turnLimit,
    })
    const expansionResult: ExpansionAiMatchResult = {
      ...result,
      comparisonNumber,
      expansionPlayerId,
      expansionDeckId:
        expansionPlayerId === 'playerA'
          ? match.playerADeckId
          : match.playerBDeckId,
      expansionCardDefinitionId: cardDefinitionId,
      expansionCardCount: cardCount,
    }
    onMatchComplete?.(expansionResult)
    return expansionResult
  })
}

export const summarizeTournament = (
  decks: readonly ThemeDeck[],
  results: readonly AiMatchResult[],
): TournamentSummary => {
  const records = new Map<ThemeDeckId, DeckTournamentRecord>(
    decks.map((deck) => [
      deck.id,
      {
        deckId: deck.id,
        played: 0,
        wins: 0,
        losses: 0,
        unresolved: 0,
        playerAWins: 0,
        playerBWins: 0,
      },
    ]),
  )
  let playerAWins = 0
  let playerBWins = 0
  let unresolvedMatches = 0

  results.forEach((result) => {
    const playerARecord = records.get(result.playerADeckId)
    const playerBRecord = records.get(result.playerBDeckId)
    if (!playerARecord || !playerBRecord) {
      throw new Error('Tournament result references an unknown deck.')
    }

    playerARecord.played += 1
    playerBRecord.played += 1
    if (result.winnerPlayerId === 'playerA') {
      playerARecord.wins += 1
      playerARecord.playerAWins += 1
      playerBRecord.losses += 1
      playerAWins += 1
    } else if (result.winnerPlayerId === 'playerB') {
      playerBRecord.wins += 1
      playerBRecord.playerBWins += 1
      playerARecord.losses += 1
      playerBWins += 1
    } else {
      playerARecord.unresolved += 1
      playerBRecord.unresolved += 1
      unresolvedMatches += 1
    }
  })

  return {
    totalMatches: results.length,
    decidedMatches: results.length - unresolvedMatches,
    unresolvedMatches,
    playerAWins,
    playerBWins,
    deckRecords: decks.map((deck) => records.get(deck.id)!),
  }
}

export const summarizeExpansionTournament = (
  decks: readonly ThemeDeck[],
  results: readonly ExpansionAiMatchResult[],
): ExpansionTournamentSummary => {
  const records = new Map<ThemeDeckId, ExpansionDeckTournamentRecord>(
    decks.map((deck) => [
      deck.id,
      {
        deckId: deck.id,
        played: 0,
        wins: 0,
        losses: 0,
        unresolved: 0,
        playerAPlayed: 0,
        playerAWins: 0,
        playerBPlayed: 0,
        playerBWins: 0,
      },
    ]),
  )
  const comparisons = new Map<number, ExpansionAiMatchResult[]>()
  let expansionWins = 0
  let baseWins = 0
  let unresolvedMatches = 0

  results.forEach((result) => {
    const record = records.get(result.expansionDeckId)
    if (!record) {
      throw new Error('Expansion tournament result references an unknown deck.')
    }
    record.played += 1
    if (result.expansionPlayerId === 'playerA') {
      record.playerAPlayed += 1
    } else {
      record.playerBPlayed += 1
    }

    if (result.winnerPlayerId === null) {
      record.unresolved += 1
      unresolvedMatches += 1
    } else if (result.winnerPlayerId === result.expansionPlayerId) {
      record.wins += 1
      expansionWins += 1
      if (result.expansionPlayerId === 'playerA') {
        record.playerAWins += 1
      } else {
        record.playerBWins += 1
      }
    } else {
      record.losses += 1
      baseWins += 1
    }

    const comparisonResults = comparisons.get(result.comparisonNumber) ?? []
    comparisonResults.push(result)
    comparisons.set(result.comparisonNumber, comparisonResults)
  })

  let favorableComparisons = 0
  let unfavorableComparisons = 0
  let splitComparisons = 0
  let unresolvedComparisons = 0
  comparisons.forEach((comparisonResults) => {
    if (
      comparisonResults.length !== 2 ||
      comparisonResults.some(({ winnerPlayerId }) => winnerPlayerId === null)
    ) {
      unresolvedComparisons += 1
      return
    }
    const wins = comparisonResults.filter(
      ({ winnerPlayerId, expansionPlayerId }) =>
        winnerPlayerId === expansionPlayerId,
    ).length
    if (wins === 2) {
      favorableComparisons += 1
    } else if (wins === 0) {
      unfavorableComparisons += 1
    } else {
      splitComparisons += 1
    }
  })

  return {
    totalMatches: results.length,
    decidedMatches: results.length - unresolvedMatches,
    expansionWins,
    baseWins,
    unresolvedMatches,
    favorableComparisons,
    unfavorableComparisons,
    splitComparisons,
    unresolvedComparisons,
    deckRecords: decks.map((deck) => records.get(deck.id)!),
  }
}

export const createDeckMatchupWinRateTable = (
  decks: readonly ThemeDeck[],
  results: readonly AiMatchResult[],
): DeckMatchupWinRateTable => {
  const uniqueIds = new Set(decks.map((deck) => deck.id))
  if (uniqueIds.size !== decks.length) {
    throw new Error('Deck IDs must be unique to create a matchup win rate table.')
  }

  const records = new Map<
    ThemeDeckId,
    Map<ThemeDeckId, { wins: number; decided: number }>
  >(
    decks.map((deck) => [
      deck.id,
      new Map(
        decks
          .filter((opponent) => opponent.id !== deck.id)
          .map((opponent) => [opponent.id, { wins: 0, decided: 0 }]),
      ),
    ]),
  )

  results.forEach((result) => {
    if (result.playerADeckId === result.playerBDeckId) {
      throw new Error('Tournament result must reference two different decks.')
    }

    const playerARecord = records
      .get(result.playerADeckId)
      ?.get(result.playerBDeckId)
    const playerBRecord = records
      .get(result.playerBDeckId)
      ?.get(result.playerADeckId)
    if (!playerARecord || !playerBRecord) {
      throw new Error('Tournament result references an unknown deck.')
    }
    if (result.winnerDeckId === null) {
      return
    }
    if (
      result.winnerDeckId !== result.playerADeckId &&
      result.winnerDeckId !== result.playerBDeckId
    ) {
      throw new Error('Tournament result winner is not part of the matchup.')
    }

    playerARecord.decided += 1
    playerBRecord.decided += 1
    if (result.winnerDeckId === result.playerADeckId) {
      playerARecord.wins += 1
    } else {
      playerBRecord.wins += 1
    }
  })

  return Object.fromEntries(
    decks.map((deck) => [
      deck.id,
      Object.fromEntries(
        decks
          .filter((opponent) => opponent.id !== deck.id)
          .map((opponent) => {
            const record = records.get(deck.id)?.get(opponent.id)
            if (!record) {
              throw new Error('Matchup record is missing.')
            }
            return [
              opponent.id,
              record.decided === 0
                ? null
                : Number(
                    (record.wins / record.decided).toFixed(
                      WIN_RATE_DECIMAL_PLACES,
                    ),
                  ),
            ]
          }),
      ),
    ]),
  )
}
