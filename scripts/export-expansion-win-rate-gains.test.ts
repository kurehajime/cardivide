import { describe, expect, it } from 'vitest'
import { calculateWinRateGain, readDeckWinRates } from './export-expansion-win-rate-gains.ts'

describe('expansion win rate gains export', () => {
  it('uses exact win counts rather than rounded display percentages and preserves decreases', () => {
    const base = readDeckWinRates('赤: 160勝 140敗 0未決着 / 勝率 53.3%', ['赤'], 300)
    const expansion = readDeckWinRates('赤: 82勝 68敗 0未決着 / 勝率 54.7% （先 44/75、後 38/75）', ['赤'], 150)
    expect(calculateWinRateGain(base['赤'], expansion['赤'])).toBe(0.0133)
    expect(calculateWinRateGain(153 / 300, 61 / 150)).toBe(-0.1033)
    expect(calculateWinRateGain(0.5, 0.5)).toBe(0)
  })

  it('rejects incomplete, duplicate and unresolved summaries', () => {
    for (const log of [
      '',
      '赤: 1勝 0敗 0未決着 / 勝率 100.0%',
      '赤: 80勝 69敗 1未決着 / 勝率 53.7%',
      '赤: 80勝 70敗 0未決着 / 勝率 53.3%\n赤: 80勝 70敗 0未決着 / 勝率 53.3%',
    ]) expect(() => readDeckWinRates(log, ['赤'], 150)).toThrow()
  })
})
