import { GameManager } from '../GameManager'
import type { PlayerId } from '../types'
import type { ThemeDeck, ThemeDeckId } from '../themeDecks'
import { GameAI } from './GameAI'

export const DEFAULT_TOURNAMENT_GAMES_PER_SIDE = 5
export const DEFAULT_TOURNAMENT_SEED = 20260816
export const DEFAULT_MATCH_TURN_LIMIT = 200

const MAX_ACTIONS_PER_MATCH = 10_000
const KEEP_ORDER_RANDOM = () => 1 - Number.EPSILON

export type TournamentMatch = {
  matchNumber: number
  gameNumber: number
  seed: number
  playerADeckId: ThemeDeckId
  playerBDeckId: ThemeDeckId
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

const hashString = (value: string): number => {
  let hash = 2_166_136_261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }
  return hash >>> 0
}

const shuffleDeck = (deck: ThemeDeck, seed: number): string[] => {
  const shuffled = [...deck.cardDefinitionIds]
  const random = createSeededRandom(seed ^ hashString(deck.id))

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

    const action = GameAI.chooseAction(manager)
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
