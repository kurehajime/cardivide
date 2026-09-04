import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  CARD_BY_DEFINITION_ID,
  createDeckMatchupWinRateTable,
  createExpansionCardSchedule,
  DEFAULT_MATCH_TURN_LIMIT,
  DEFAULT_TOURNAMENT_GAMES_PER_SIDE,
  DEFAULT_TOURNAMENT_SEED,
  EXPANSION_CARD_DEFINITION_IDS,
  runExpansionCardTournament,
  runRoundRobinTournament,
  summarizeExpansionTournament,
  summarizeTournament,
  THEME_DECKS,
  type AiMatchResult,
  type CardDefinitionId,
  type ExpansionAiMatchResult,
  type ThemeDeckId,
} from '../src/game/index.ts'

const deckNames = new Map<ThemeDeckId, string>(
  THEME_DECKS.map((deck) => [deck.id, deck.name]),
)
const expansionCardDefinitionIds = new Set<CardDefinitionId>(
  EXPANSION_CARD_DEFINITION_IDS,
)

const getDeckName = (deckId: ThemeDeckId): string =>
  deckNames.get(deckId) ?? deckId

const formatWinRate = (wins: number, losses: number): string => {
  const decided = wins + losses
  return decided === 0 ? '-' : `${((wins / decided) * 100).toFixed(1)}%`
}

const getResultText = (result: AiMatchResult): string =>
  result.winnerDeckId
    ? `${getDeckName(result.winnerDeckId)} 勝利`
    : `未決着（${result.termination === 'turnLimit' ? 'ターン上限' : '行動上限'}）`

const formatMatchResult = (
  result: AiMatchResult,
  totalMatches: number,
): string => {
  const matchNumberWidth = String(totalMatches).length
  return [
    `[${String(result.matchNumber).padStart(matchNumberWidth, '0')}/${totalMatches}]`,
    `${getDeckName(result.playerADeckId)}（先） vs ${getDeckName(result.playerBDeckId)}（後）:`,
    getResultText(result),
    `Turn ${result.turn}`,
    `HP 先${result.playerAHp} / 後${result.playerBHp}`,
  ].join(' ')
}

const runStandardTournament = (): void => {
  const pairingCount = (THEME_DECKS.length * (THEME_DECKS.length - 1)) / 2
  const totalMatches = pairingCount * 2 * DEFAULT_TOURNAMENT_GAMES_PER_SIDE

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
    onMatchComplete: (result) =>
      console.log(formatMatchResult(result, totalMatches)),
  })
  const summary = summarizeTournament(THEME_DECKS, results)
  const matchupWinRates = createDeckMatchupWinRateTable(THEME_DECKS, results)
  const matchupWinRatesUrl = new URL(
    '../src/game/ai/deck-matchup-win-rates.json',
    import.meta.url,
  )

  writeFileSync(
    matchupWinRatesUrl,
    `${JSON.stringify(matchupWinRates, null, 2)}\n`,
    'utf8',
  )

  console.log('')
  console.log('デッキ別集計')
  summary.deckRecords.forEach((record) => {
    console.log(
      `${getDeckName(record.deckId)}: ${record.wins}勝 ${record.losses}敗 ` +
        `${record.unresolved}未決着 / 勝率 ${formatWinRate(record.wins, record.losses)}`,
    )
  })

  console.log('')
  console.log(
    `先後集計: 先手 ${summary.playerAWins}勝 / 後手 ${summary.playerBWins}勝 / ` +
      `未決着 ${summary.unresolvedMatches}戦`,
  )
  console.log(`直接対戦勝率JSON: ${fileURLToPath(matchupWinRatesUrl)}`)
}

const formatExpansionMatchResult = (
  result: ExpansionAiMatchResult,
  totalMatches: number,
): string => {
  const playerAExpansion = result.expansionPlayerId === 'playerA' ? '・拡張' : ''
  const playerBExpansion = result.expansionPlayerId === 'playerB' ? '・拡張' : ''
  const resultText =
    result.winnerPlayerId === null
      ? `未決着（${result.termination === 'turnLimit' ? 'ターン上限' : '行動上限'}）`
      : result.winnerPlayerId === result.expansionPlayerId
        ? '拡張側勝利'
        : '通常側勝利'
  const matchNumberWidth = String(totalMatches).length

  return [
    `[${String(result.matchNumber).padStart(matchNumberWidth, '0')}/${totalMatches}]`,
    `${getDeckName(result.playerADeckId)}（先${playerAExpansion}） vs`,
    `${getDeckName(result.playerBDeckId)}（後${playerBExpansion}）:`,
    resultText,
    `Turn ${result.turn}`,
    `HP 先${result.playerAHp} / 後${result.playerBHp}`,
  ].join(' ')
}

const runExpansionTournament = (
  expansionCardDefinitionId: CardDefinitionId,
  expansionCardCount: number,
): void => {
  const card = CARD_BY_DEFINITION_ID[expansionCardDefinitionId]
  if (!card) {
    throw new Error(`Unknown card definition: ${expansionCardDefinitionId}`)
  }
  if (!expansionCardDefinitionIds.has(expansionCardDefinitionId)) {
    throw new Error(`Card is not registered as an expansion card: ${card.name}`)
  }
  if (!Number.isInteger(expansionCardCount) || expansionCardCount <= 0) {
    throw new Error('Expansion card count must be a positive integer.')
  }

  const schedule = createExpansionCardSchedule(
    THEME_DECKS,
    expansionCardDefinitionId,
    expansionCardCount,
  )
  const totalMatches = schedule.length
  const comparisonCount = totalMatches / 2

  console.log('AI拡張カード評価戦')
  console.log(
    `${card.name}（${expansionCardDefinitionId}）を片方のデッキへ${expansionCardCount}枚追加`,
  )
  console.log(`${comparisonCount}条件 × 拡張側2通り = ${totalMatches}戦`)
  console.log(
    `固定シード: ${DEFAULT_TOURNAMENT_SEED} / 未決着判定: ${DEFAULT_MATCH_TURN_LIMIT}ターン超過`,
  )
  console.log('このモードでは直接対戦勝率JSONを更新しません。')
  console.log('')

  const results = runExpansionCardTournament({
    decks: THEME_DECKS,
    expansionCardDefinitionId,
    expansionCardCount,
    onMatchComplete: (result) =>
      console.log(formatExpansionMatchResult(result, totalMatches)),
  })
  const summary = summarizeExpansionTournament(THEME_DECKS, results)

  console.log('')
  console.log('拡張カード追加側集計')
  console.log(
    `全体: ${summary.expansionWins}勝 ${summary.baseWins}敗 ` +
      `${summary.unresolvedMatches}未決着 / 勝率 ` +
      formatWinRate(summary.expansionWins, summary.baseWins),
  )
  summary.deckRecords.forEach((record) => {
    console.log(
      `${getDeckName(record.deckId)}: ${record.wins}勝 ${record.losses}敗 ` +
        `${record.unresolved}未決着 / 勝率 ${formatWinRate(record.wins, record.losses)} ` +
        `（先 ${record.playerAWins}/${record.playerAPlayed}、` +
        `後 ${record.playerBWins}/${record.playerBPlayed}）`,
    )
  })

  console.log('')
  console.log('同一条件ペア比較')
  console.log(
    `拡張側が両方勝利 ${summary.favorableComparisons}組 / ` +
      `通常側が両方勝利 ${summary.unfavorableComparisons}組 / ` +
      `勝敗分割 ${summary.splitComparisons}組 / ` +
      `未決着を含む ${summary.unresolvedComparisons}組`,
  )
}

const args = process.argv.slice(2)
if (args.length === 0) {
  runStandardTournament()
} else {
  if (args.length !== 2) {
    throw new Error(
      'Usage: npm run ai:tournament -- <card-definition-uuid> <card-count>',
    )
  }
  const [definitionId, countText] = args
  runExpansionTournament(
    definitionId as CardDefinitionId,
    Number(countText),
  )
}
