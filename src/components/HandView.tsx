import { motion } from 'motion/react'
import type { CardInstance, CardInstanceId } from '../game'
import CardView from './CardView'

type HandViewProps = {
  cards: CardInstance[]
  playerName: string
  position: 'top' | 'bottom'
  playableCardIds?: ReadonlySet<CardInstanceId>
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
  playableCardIds,
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
        const unavailable =
          card !== null && playableCardIds !== undefined && !playableCardIds.has(card.id)
        const cardClassName = [
          'hand-card-button',
          unavailable ? 'hand-card-unavailable' : '',
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
            title={unavailable ? '現在は使用できません' : undefined}
            disabled={!card || disabled || unavailable}
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
