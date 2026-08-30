import { motion } from 'motion/react'
import type { CSSProperties } from 'react'
import {
  THEME_DECK_BY_ID,
  type CardColor,
  type ThemeDeckId,
} from '../game'
import { PLAYER_IMAGE_BY_DECK_ID } from './playerImages'

type ScenarioProgressDialogProps = {
  opponentDeckIds: readonly ThemeDeckId[]
  currentBattleIndex: number
  result: 'intro' | 'win' | 'loss'
  onConfirm: () => void
}

const DECK_COLOR_VALUES = {
  red: '#6f3028',
  blue: '#2b5278',
  green: '#315d42',
} satisfies Record<CardColor, string>

const ScenarioProgressDialog = ({
  opponentDeckIds,
  currentBattleIndex,
  result,
  onConfirm,
}: ScenarioProgressDialogProps) => {
  const playerWon = result === 'win'
  const scenarioComplete =
    playerWon && currentBattleIndex === opponentDeckIds.length - 1
  const nextBattleIndex =
    result === 'intro'
      ? currentBattleIndex
      : playerWon && !scenarioComplete
        ? currentBattleIndex + 1
        : null
  const nextOpponent =
    nextBattleIndex === null
      ? null
      : THEME_DECK_BY_ID[opponentDeckIds[nextBattleIndex]]
  const title =
    result === 'intro'
      ? 'シナリオ開始'
      : scenarioComplete
        ? 'シナリオクリア'
        : playerWon
          ? '勝利'
          : '敗北'
  const description =
    result === 'intro' && nextOpponent
      ? `最初の対戦相手は「${nextOpponent.name}」`
      : scenarioComplete
        ? 'すべての対戦相手を撃破しました'
        : nextOpponent
          ? `次の対戦相手は「${nextOpponent.name}」`
          : 'お疲れ様でした'

  return (
    <motion.div
      className="game-result-overlay scenario-result-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <motion.section
        className="scenario-result-dialog"
        data-result={scenarioComplete ? 'complete' : result}
        role="dialog"
        aria-modal="true"
        aria-labelledby="scenario-result-title"
        aria-describedby="scenario-result-description"
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.06, duration: 0.34, ease: 'easeOut' }}
      >
        <header className="scenario-result-header">
          <h2 id="scenario-result-title">{title}</h2>
          <span id="scenario-result-description">{description}</span>
        </header>
        <ol className="scenario-opponent-track" aria-label="対戦相手一覧">
          {opponentDeckIds.map((deckId, index) => {
            const deck = THEME_DECK_BY_ID[deckId]
            const mainColor = deck.colors[0]
            const subColor = deck.colors[1] ?? mainColor
            const defeated =
              index < currentBattleIndex ||
              (playerWon && index === currentBattleIndex)
            const next = index === nextBattleIndex
            const failed = result === 'loss' && index === currentBattleIndex
            const stateLabel = defeated
              ? '撃破済み'
              : next
                ? '次の対戦相手'
                : failed
                  ? '敗北した相手'
                  : '未対戦'

            return (
              <li
                key={deckId}
                className={[
                  'scenario-opponent',
                  defeated ? 'scenario-opponent-defeated' : '',
                  next ? 'scenario-opponent-next' : '',
                  failed ? 'scenario-opponent-failed' : '',
                ].filter(Boolean).join(' ')}
                aria-current={next ? 'step' : undefined}
                aria-label={`${index + 1}戦目 ${deck.name} ${stateLabel}`}
              >
                <span className="scenario-opponent-state" aria-hidden="true">
                  {next ? '次の対戦' : failed ? '敗北' : '\u00a0'}
                </span>
                <span
                  className="scenario-opponent-icon"
                  style={
                    {
                      '--scenario-main-color': DECK_COLOR_VALUES[mainColor],
                      '--scenario-sub-color': DECK_COLOR_VALUES[subColor],
                    } as CSSProperties
                  }
                >
                  <img
                    src={PLAYER_IMAGE_BY_DECK_ID[deckId]}
                    alt=""
                    aria-hidden="true"
                  />
                  {defeated && (
                    <span className="scenario-opponent-cross" aria-hidden="true">
                      ×
                    </span>
                  )}
                </span>
                <span className="scenario-opponent-order">Battle {index + 1}</span>
                <strong>{deck.name}</strong>
              </li>
            )
          })}
        </ol>
        <button
          className="scenario-result-confirm"
          type="button"
          autoFocus
          onClick={onConfirm}
        >
          {result === 'intro'
            ? '対戦開始'
            : nextBattleIndex === null
              ? 'OK'
              : '次の対戦へ'}
        </button>
      </motion.section>
    </motion.div>
  )
}

export default ScenarioProgressDialog
