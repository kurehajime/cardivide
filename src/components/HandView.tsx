import { motion } from 'motion/react'
import type { CardInstance, CardInstanceId } from '../game'
import CardView from './CardView'

type HandViewProps = {
  cards: CardInstance[]
  playerName: string
  position: 'top' | 'bottom'
  availableMana: number
  active?: boolean
  disabled?: boolean
  selectedCardId?: CardInstanceId | null
  onCardClick?: (cardId: CardInstanceId) => void
}

const EMPTY_HAND_SLOTS = 5

const HandView = ({
  cards,
  playerName,
  position,
  availableMana,
  active = false,
  disabled = false,
  selectedCardId = null,
  onCardClick,
}: HandViewProps) => {
  const visibleCards = cards.length > 0 ? cards : Array.from({ length: EMPTY_HAND_SLOTS }, () => null)

  return (
    <section
      className={`hand-panel hand-panel-${position} ${active ? 'hand-panel-active' : ''}`}
      aria-label={`${playerName} hand`}
    >
      {visibleCards.map((card, index) => {
        const unaffordable = card !== null && card.card.cost > availableMana
        const cardClassName = [
          'hand-card-button',
          unaffordable ? 'hand-card-unaffordable' : '',
          selectedCardId === card?.id ? 'hand-card-selected' : '',
        ]
          .filter(Boolean)
          .join(' ')

        return (
          <motion.button
            key={card?.id ?? `empty-${index}`}
            layout="position"
            layoutId={card ? `card-${card.id}` : undefined}
            data-card-id={card?.id}
            className={cardClassName}
            type="button"
            title={unaffordable ? 'マナ不足' : undefined}
            disabled={!card || disabled || unaffordable}
            onClick={() => card && onCardClick?.(card.id)}
          >
            <CardView card={card?.card ?? null} compact />
          </motion.button>
        )
      })}
    </section>
  )
}

export default HandView
