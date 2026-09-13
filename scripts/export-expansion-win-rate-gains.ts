import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { CARD_BY_DEFINITION_ID, EXPANSION_CARD_DEFINITION_IDS } from '../src/game/cards.ts'
import { THEME_DECKS } from '../src/game/themeDecks.ts'

// Require complete, decided logs so missing data never becomes an apparent 0% gain.
export const readDeckWinRates = (
  log: string,
  deckNames: readonly string[],
  expectedGames: number,
): Record<string, number> => {
  const rates: Record<string, number> = {}
  for (const name of deckNames) {
    const lines = log.split('\n').filter((line) => line.startsWith(`${name}: `))
    const match = lines.length === 1
      ? lines[0].match(/^.+: (\d+)勝 (\d+)敗 (\d+)未決着 \/ 勝率 /)
      : null
    if (!match) throw new Error(`Missing or duplicate deck summary: ${name}`)
    const [, winsText, lossesText, unresolvedText] = match
    const wins = Number(winsText)
    const losses = Number(lossesText)
    if (Number(unresolvedText) !== 0 || wins + losses !== expectedGames) {
      throw new Error(`Expected ${expectedGames} decided games for ${name}`)
    }
    rates[name] = wins / (wins + losses)
  }
  return rates
}

export const calculateWinRateGain = (baseRate: number, expansionRate: number): number =>
  Number((expansionRate - baseRate).toFixed(4))

const main = (): void => {
  const logsUrl = new URL('../拡張カード検証/', import.meta.url)
  const names = THEME_DECKS.map((deck) => deck.name)
  const normalLog = readFileSync(new URL('通常.log', logsUrl), 'utf8')
  const settings = normalLog.match(/^固定シード: .+$/m)?.[0]
  if (!settings) throw new Error('Missing normal tournament settings')
  const baseRates = readDeckWinRates(normalLog, names, 300)
  const gains: Record<string, Record<string, number>> = Object.fromEntries(
    THEME_DECKS.map((deck) => [deck.id, {}]),
  )

  for (const cardId of EXPANSION_CARD_DEFINITION_IDS) {
    const card = CARD_BY_DEFINITION_ID[cardId]
    if (!card) throw new Error(`Unknown expansion card: ${cardId}`)
    const log = readFileSync(new URL(`${cardId}_${card.name}_2枚.log`, logsUrl), 'utf8')
    if (
      log.match(/^固定シード: .+$/m)?.[0] !== settings ||
      !log.includes(`${card.name}（${cardId}）を片方のデッキへ2枚追加`)
    ) {
      throw new Error(`Mismatched expansion tournament settings: ${card.name}`)
    }
    const expansionRates = readDeckWinRates(log, names, 150)
    for (const deck of THEME_DECKS) {
      gains[deck.id][cardId] = calculateWinRateGain(baseRates[deck.name], expansionRates[deck.name])
    }
  }

  // Write only after every registered expansion log has been validated.
  writeFileSync(
    new URL('../src/game/ai/deck-expansion-win-rate-gains.json', import.meta.url),
    `${JSON.stringify(gains, null, 2)}\n`,
  )
  console.log(`拡張2枚の平均勝率上昇値JSONを更新: ${THEME_DECKS.length}デッキ × ${EXPANSION_CARD_DEFINITION_IDS.length}種類`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
