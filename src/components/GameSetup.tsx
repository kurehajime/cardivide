import { useState } from 'react'
import {
  THEME_DECK_BY_ID,
  THEME_DECKS,
  type AiDifficulty,
  type CardColor,
  type ThemeDeck,
  type ThemeDeckId,
} from '../game'

type GameSetupProps = {
  initialPlayerDeckId: ThemeDeckId
  initialComDeckId: ThemeDeckId
  initialDifficulty: AiDifficulty
  onStart: (
    playerDeckId: ThemeDeckId,
    comDeckId: ThemeDeckId,
    difficulty: AiDifficulty,
  ) => void
}

const AI_DIFFICULTIES: readonly {
  value: AiDifficulty
  label: string
}[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'normal', label: 'Normal' },
  { value: 'hard', label: 'Hard' },
]

const COLOR_LABELS: Record<CardColor, string> = {
  red: '赤',
  blue: '青',
  green: '緑',
}

const isThemeDeckId = (value: string): value is ThemeDeckId =>
  Object.prototype.hasOwnProperty.call(THEME_DECK_BY_ID, value)

const DeckSummary = ({ deck }: { deck: ThemeDeck }) => (
  <div className="setup-deck-summary">
    <div className="setup-deck-heading">
      <strong>{deck.name}</strong>
      <span>40枚</span>
    </div>
    <div className="setup-deck-colors" aria-label={deck.colors.map((color) => COLOR_LABELS[color]).join('・')}>
      {deck.colors.map((color) => (
        <span key={color} className="setup-deck-color">
          <span className={`setup-color-swatch setup-color-${color}`} aria-hidden="true" />
          {COLOR_LABELS[color]}
        </span>
      ))}
    </div>
    <p>{deck.description}</p>
  </div>
)

const DeckSelector = ({
  label,
  value,
  onChange,
}: {
  label: string
  value: ThemeDeckId
  onChange: (deckId: ThemeDeckId) => void
}) => {
  const deck = THEME_DECK_BY_ID[value] ?? THEME_DECKS[0]

  return (
    <fieldset className="setup-deck-fieldset">
      <legend>{label}</legend>
      <label className="setup-select-label">
        テーマデッキ
        <select
          value={value}
          onChange={(event) => {
            const deckId = event.currentTarget.value
            if (isThemeDeckId(deckId)) {
              onChange(deckId)
            }
          }}
        >
          {THEME_DECKS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}（{option.colors.map((color) => COLOR_LABELS[color]).join('・')}）
            </option>
          ))}
        </select>
      </label>
      <DeckSummary deck={deck} />
    </fieldset>
  )
}

const GameSetup = ({
  initialPlayerDeckId,
  initialComDeckId,
  initialDifficulty,
  onStart,
}: GameSetupProps) => {
  const [playerDeckId, setPlayerDeckId] = useState<ThemeDeckId>(initialPlayerDeckId)
  const [comDeckId, setComDeckId] = useState<ThemeDeckId>(initialComDeckId)
  const [difficulty, setDifficulty] = useState<AiDifficulty>(initialDifficulty)

  return (
    <main className="setup-shell">
      <header className="setup-header">
        <h1>Card Line</h1>
        <span>対戦設定</span>
      </header>
      <section className="setup-panel" aria-label="デッキ選択">
        <div className="setup-deck-grid">
          <DeckSelector
            label="プレイヤー"
            value={playerDeckId}
            onChange={setPlayerDeckId}
          />
          <DeckSelector label="COM" value={comDeckId} onChange={setComDeckId} />
        </div>
        <fieldset className="setup-difficulty-fieldset">
          <legend>COM難易度</legend>
          <div className="setup-difficulty-options">
            {AI_DIFFICULTIES.map((option) => (
              <label key={option.value}>
                <input
                  type="radio"
                  name="com-difficulty"
                  value={option.value}
                  checked={difficulty === option.value}
                  onChange={() => setDifficulty(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <button
          className="setup-start-button"
          type="button"
          onClick={() => onStart(playerDeckId, comDeckId, difficulty)}
        >
          ゲーム開始
        </button>
      </section>
    </main>
  )
}

export default GameSetup
