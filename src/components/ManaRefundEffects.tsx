import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import type { CardInstance, CardInstanceId } from '../game'

type ManaRefundEffectsProps = {
  boardRef: RefObject<HTMLElement | null>
  cardIds: readonly CardInstanceId[]
  cards: Record<CardInstanceId, CardInstance>
}

type ManaRefundFlight = {
  id: number
  cardId: CardInstanceId
  startX: number
  startY: number
  endX: number
  endY: number
}

const ManaRefundEffects = ({ boardRef, cardIds, cards }: ManaRefundEffectsProps) => {
  const sequenceRef = useRef(0)
  const [flights, setFlights] = useState<ManaRefundFlight[]>([])
  const cardIdKey = cardIds.join(',')

  useLayoutEffect(() => {
    const boardElement = boardRef.current
    if (cardIdKey === '' || boardElement === null) {
      setFlights([])
      return
    }

    sequenceRef.current += 1
    const sequence = sequenceRef.current
    const nextFlights = cardIds.flatMap((cardId, index): ManaRefundFlight[] => {
      const cardElement = boardElement.querySelector<HTMLElement>(
        `[data-card-id="${cardId}"]`,
      )
      const ownerId = cards[cardId]?.ownerId
      const playerElement = ownerId
        ? boardElement.querySelector<HTMLElement>(`[data-player-id="${ownerId}"]`)
        : null
      if (cardElement === null || playerElement === null) {
        return []
      }

      const cardRect = cardElement.getBoundingClientRect()
      const playerRect = playerElement.getBoundingClientRect()
      return [{
        id: sequence * 100 + index,
        cardId,
        startX: cardRect.left + cardRect.width / 2,
        startY: cardRect.top + cardRect.height / 2,
        endX: playerRect.left + playerRect.width / 2,
        endY: playerRect.top + playerRect.height / 2,
      }]
    })

    setFlights(nextFlights)
  }, [boardRef, cardIdKey, cardIds, cards])

  if (flights.length === 0) {
    return null
  }

  return createPortal(
    <div className="mana-refund-effects" aria-hidden="true">
      {flights.map((flight) => {
        const deltaX = flight.endX - flight.startX
        const deltaY = flight.endY - flight.startY
        return (
          <motion.span
            className="mana-refund-flight"
            data-mana-refund-card-id={flight.cardId}
            key={flight.id}
            initial={{
              x: flight.startX,
              y: flight.startY,
              opacity: 0,
              scale: 0.3,
            }}
            animate={{
              x: [
                flight.startX,
                flight.startX + deltaX * 0.18,
                flight.startX + deltaX * 0.68,
                flight.endX,
              ],
              y: [
                flight.startY,
                flight.startY + deltaY * 0.18 - 8,
                flight.startY + deltaY * 0.68 - 20,
                flight.endY,
              ],
              opacity: [0, 1, 0.88, 0],
              scale: [0.3, 1.15, 0.78, 0.25],
            }}
            transition={{
              delay: 0.04,
              duration: 0.44,
              times: [0, 0.18, 0.78, 1],
              ease: 'easeInOut',
            }}
          />
        )
      })}
    </div>,
    document.body,
  )
}

export default ManaRefundEffects
