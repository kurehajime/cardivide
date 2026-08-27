import { motion } from 'motion/react'
import type { CardInstance, CardInstanceId } from '../game'
import CardView from './CardView'

type HandViewProps = {
  cards: CardInstance[]
  faceDown?: boolean
  playerName: string
  position: 'top' | 'bottom'
  playableCardIds?: ReadonlySet<CardInstanceId>
  directlyPlayableSpellIds?: ReadonlySet<CardInstanceId>
  discardableCardIds?: ReadonlySet<CardInstanceId>
  active?: boolean
  disabled?: boolean
  selectedCardId?: CardInstanceId | null
  onCardClick?: (cardId: CardInstanceId) => void
  onDiscardCard?: (cardId: CardInstanceId) => void
  onPlaySpell?: (cardId: CardInstanceId) => void
}

const EMPTY_HAND_SLOTS = 5
const DISCARD_ICON_URL = `${import.meta.env.BASE_URL}trash.svg`

const HandView = ({
  cards,
  faceDown = false,
  playerName,
  position,
  playableCardIds,
  directlyPlayableSpellIds,
  discardableCardIds,
  active = false,
  disabled = false,
  selectedCardId = null,
  onCardClick,
  onDiscardCard,
  onPlaySpell,
}: HandViewProps) => {
  const isEmpty = cards.length === 0
  const visibleCards = isEmpty ? Array.from({ length: EMPTY_HAND_SLOTS }, () => null) : cards

  return (
    <section
      className={`hand-panel hand-panel-${position} ${active ? 'hand-panel-active' : ''} ${isEmpty ? 'hand-panel-empty' : ''}`}
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

        const cardButton = (
          <motion.button
            key={card?.id ?? `empty-${index}`}
            layout="position"
            layoutId={card ? `card-${card.id}` : undefined}
            data-card-id={card?.id}
            className={cardClassName}
            type="button"
            aria-label={faceDown ? '裏向きのカード' : card?.card.name}
            title={unavailable ? '現在は使用できません' : undefined}
            disabled={!card || disabled || unavailable}
            onClick={() => card && onCardClick?.(card.id)}
          >
            <CardView
              card={card?.card ?? null}
              compact
              faceDown={faceDown}
              nestedInButton
            />
          </motion.button>
        )

        if (position === 'top') {
          return cardButton
        }

        const canDiscard = card !== null && discardableCardIds?.has(card.id) === true
        const canPlaySelectedSpell =
          card !== null &&
          card.card.kind === 'spell' &&
          selectedCardId === card.id &&
          directlyPlayableSpellIds?.has(card.id) === true
        return (
          <div className="hand-card-slot" key={card?.id ?? `empty-${index}`}>
            <div className="hand-card-main">
              {cardButton}
              {canPlaySelectedSpell && (
                <button
                  className="hand-spell-play-button"
                  type="button"
                  aria-label={`${card.card.name}を使用する`}
                  onClick={() => onPlaySpell?.(card.id)}
                >
                  使用
                </button>
              )}
            </div>
            {card !== null && (
              <button
                className="hand-discard-button"
                type="button"
                aria-label={`${card.card.name}を捨てる`}
                title="このカードを捨てる"
                disabled={!canDiscard}
                onClick={() => onDiscardCard?.(card.id)}
              >
                <img src={DISCARD_ICON_URL} alt="" />
              </button>
            )}
          </div>
        )
      })}
    </section>
  )
}

export default HandView
