import type { CardInstance, CardInstanceId } from '../game'
import CardView from './CardView'

type HandViewProps = {
  cards: CardInstance[]
  playerName: string
  position: 'top' | 'bottom'
  disabled?: boolean
  selectedCardId?: CardInstanceId | null
  onCardClick?: (cardId: CardInstanceId) => void
}

const EMPTY_HAND_SLOTS = 5

const HandView = ({
  cards,
  playerName,
  position,
  disabled = false,
  selectedCardId = null,
  onCardClick,
}: HandViewProps) => {
  const visibleCards = cards.length > 0 ? cards : Array.from({ length: EMPTY_HAND_SLOTS }, () => null)

  return (
    <section className={`hand-panel hand-panel-${position}`} aria-label={`${playerName} hand`}>
      {visibleCards.map((card, index) => (
        <button
          key={card?.id ?? `empty-${index}`}
          data-card-id={card?.id}
          className={`hand-card-button ${selectedCardId === card?.id ? 'hand-card-selected' : ''}`}
          type="button"
          disabled={!card || disabled}
          onClick={() => card && onCardClick?.(card.id)}
        >
          <CardView card={card?.card ?? null} compact />
        </button>
      ))}
    </section>
  )
}

export default HandView
