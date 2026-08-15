import type { Card } from '../game'
import CardView from './CardView'

type HandViewProps = {
  cards: Card[]
  playerName: string
  position: 'top' | 'bottom'
}

const EMPTY_HAND_SLOTS = 5

const HandView = ({ cards, playerName, position }: HandViewProps) => {
  const visibleCards = cards.length > 0 ? cards : Array.from({ length: EMPTY_HAND_SLOTS }, () => null)

  return (
    <section className={`hand-panel hand-panel-${position}`} aria-label={`${playerName} hand`}>
      <div className="hand-label">{playerName} Hand</div>
      {visibleCards.map((card, index) => (
        <button key={card?.id ?? `empty-${index}`} className="hand-card-button" type="button" disabled={!card}>
          <CardView card={card} compact />
        </button>
      ))}
    </section>
  )
}

export default HandView
