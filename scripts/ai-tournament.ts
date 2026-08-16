import {
  DEFAULT_MATCH_TURN_LIMIT,
  DEFAULT_TOURNAMENT_GAMES_PER_SIDE,
  DEFAULT_TOURNAMENT_SEED,
  runRoundRobinTournament,
  summarizeTournament,
  THEME_DECKS,
  type AiMatchResult,
  type ThemeDeckId,
} from '../src/game/index.ts'

const deckNames = new Map<ThemeDeckId, string>(
  THEME_DECKS.map((deck) => [deck.id, deck.name]),
)
const pairingCount = (THEME_DECKS.length * (THEME_DECKS.length - 1)) / 2
const totalMatches =
  pairingCount * 2 * DEFAULT_TOURNAMENT_GAMES_PER_SIDE
const matchNumberWidth = String(totalMatches).length

const getDeckName = (deckId: ThemeDeckId): string =>
  deckNames.get(deckId) ?? deckId

const formatMatchResult = (result: AiMatchResult): string => {
  const playerAName = getDeckName(result.playerADeckId)
  const playerBName = getDeckName(result.playerBDeckId)
  const resultText = result.winnerDeckId
    ? `${getDeckName(result.winnerDeckId)} 勝利`
    : `未決着（${result.termination === 'turnLimit' ? 'ターン上限' : '行動上限'}）`

  return [
    `[${String(result.matchNumber).padStart(matchNumberWidth, '0')}/${totalMatches}]`,
    `${playerAName}（先） vs ${playerBName}（後）:`,
    resultText,
    `Turn ${result.turn}`,
    `HP 先${result.playerAHp} / 後${result.playerBHp}`,
  ].join(' ')
}

console.log('AIテーマデッキ総当たり戦')
console.log(
  `${pairingCount}組 × 先後2通り × ${DEFAULT_TOURNAMENT_GAMES_PER_SIDE}戦 = ${totalMatches}戦`,
)
console.log(
  `固定シード: ${DEFAULT_TOURNAMENT_SEED} / 未決着判定: ${DEFAULT_MATCH_TURN_LIMIT}ターン超過`,
)
console.log('')

const results = runRoundRobinTournament({
  decks: THEME_DECKS,
  onMatchComplete: (result) => console.log(formatMatchResult(result)),
})
const summary = summarizeTournament(THEME_DECKS, results)

console.log('')
console.log('デッキ別集計')
summary.deckRecords.forEach((record) => {
  const decided = record.wins + record.losses
  const winRate = decided === 0 ? '-' : `${((record.wins / decided) * 100).toFixed(1)}%`
  console.log(
    `${getDeckName(record.deckId)}: ${record.wins}勝 ${record.losses}敗 ` +
      `${record.unresolved}未決着 / 勝率 ${winRate}`,
  )
})

console.log('')
console.log(
  `先後集計: 先手 ${summary.playerAWins}勝 / 後手 ${summary.playerBWins}勝 / ` +
    `未決着 ${summary.unresolvedMatches}戦`,
)
