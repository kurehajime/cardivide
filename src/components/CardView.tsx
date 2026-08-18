import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatAbility, type Card, type CreatureStatModifier } from '../game'

type CardViewProps = {
  card: Card | null
  compact?: boolean
  faceDown?: boolean
  label?: string
  nestedInButton?: boolean
  statModifier?: CreatureStatModifier
}

const COLOR_LABELS = {
  red: '赤',
  blue: '青',
  green: '緑',
} as const

const KIND_LABELS = {
  creature: 'クリーチャー',
  formation: '布陣',
  spell: '呪文',
} as const

type DetailPlacement = 'top' | 'right' | 'bottom' | 'left'

type DetailPosition = {
  placement: DetailPlacement
  top: number
  left: number
}

const DETAIL_GAP = 10
const VIEWPORT_PADDING = 12

const getRulesText = (card: Card): string => {
  if (card.kind === 'creature') {
    return card.abilities.length > 0 ? card.abilities.map(formatAbility).join(' / ') : '能力なし'
  }
  return card.text
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), Math.max(minimum, maximum))

const CardView = ({
  card,
  compact = false,
  faceDown = false,
  label,
  nestedInButton = false,
  statModifier,
}: CardViewProps) => {
  const cardRef = useRef<HTMLElement>(null)
  const detailRef = useRef<HTMLDivElement>(null)
  const detailId = useId()
  const [showDetail, setShowDetail] = useState(false)
  const [detailPosition, setDetailPosition] = useState<DetailPosition | null>(null)

  const openDetail = useCallback(() => {
    setDetailPosition(null)
    setShowDetail(true)
  }, [])

  const closeDetail = useCallback(() => {
    setShowDetail(false)
  }, [])

  const updateDetailPosition = useCallback(() => {
    const cardElement = cardRef.current
    const detailElement = detailRef.current
    if (!cardElement || !detailElement) {
      return
    }

    const cardRect = cardElement.getBoundingClientRect()
    const detailRect = detailElement.getBoundingClientRect()
    const availableRight = window.innerWidth - cardRect.right - DETAIL_GAP - VIEWPORT_PADDING
    const availableLeft = cardRect.left - DETAIL_GAP - VIEWPORT_PADDING
    const availableBottom = window.innerHeight - cardRect.bottom - DETAIL_GAP - VIEWPORT_PADDING

    let placement: DetailPlacement
    let top: number
    let left: number

    if (availableRight >= detailRect.width) {
      placement = 'right'
      top = cardRect.top + (cardRect.height - detailRect.height) / 2
      left = cardRect.right + DETAIL_GAP
    } else if (availableLeft >= detailRect.width) {
      placement = 'left'
      top = cardRect.top + (cardRect.height - detailRect.height) / 2
      left = cardRect.left - detailRect.width - DETAIL_GAP
    } else if (availableBottom >= detailRect.height) {
      placement = 'bottom'
      top = cardRect.bottom + DETAIL_GAP
      left = cardRect.left + (cardRect.width - detailRect.width) / 2
    } else {
      placement = 'top'
      top = cardRect.top - detailRect.height - DETAIL_GAP
      left = cardRect.left + (cardRect.width - detailRect.width) / 2
    }

    setDetailPosition({
      placement,
      top: clamp(top, VIEWPORT_PADDING, window.innerHeight - detailRect.height - VIEWPORT_PADDING),
      left: clamp(left, VIEWPORT_PADDING, window.innerWidth - detailRect.width - VIEWPORT_PADDING),
    })
  }, [])

  useLayoutEffect(() => {
    if (!showDetail) {
      return
    }

    updateDetailPosition()
    window.addEventListener('resize', updateDetailPosition)
    window.addEventListener('scroll', updateDetailPosition, true)

    return () => {
      window.removeEventListener('resize', updateDetailPosition)
      window.removeEventListener('scroll', updateDetailPosition, true)
    }
  }, [showDetail, updateDetailPosition])

  useEffect(() => {
    if (!nestedInButton) {
      return
    }

    const button = cardRef.current?.closest('button')
    button?.addEventListener('focus', openDetail)
    button?.addEventListener('blur', closeDetail)

    return () => {
      button?.removeEventListener('focus', openDetail)
      button?.removeEventListener('blur', closeDetail)
    }
  }, [closeDetail, nestedInButton, openDetail])

  if (!card || faceDown) {
    return (
      <article className={`card-view card-empty ${compact ? 'card-compact' : ''}`}>
        <div className="card-empty-label">{label ?? ''}</div>
      </article>
    )
  }

  const colorClass = card.kind === 'spell' ? 'neutral' : card.color
  const colorLabel = card.kind === 'spell' ? '無' : COLOR_LABELS[card.color]
  const hasAttackModifier = statModifier !== undefined && statModifier.attack !== 0
  const hasDefenseModifier = statModifier !== undefined && statModifier.defense !== 0
  const hasStatModifier = hasAttackModifier || hasDefenseModifier
  const formatModifier = (value: number) => `${value > 0 ? '+' : ''}${value}`

  return (
    <article
      ref={cardRef}
      className={`card-view card-${colorClass} ${compact ? 'card-compact' : ''} ${hasStatModifier ? 'card-with-stat-modifiers' : ''}`}
      aria-describedby={showDetail ? detailId : undefined}
      aria-label={card.name}
      tabIndex={nestedInButton ? undefined : 0}
      onBlur={closeDetail}
      onFocus={openDetail}
      onPointerEnter={openDetail}
      onPointerLeave={closeDetail}
    >
      <div className="card-face">
        <header className="card-face-header">
          <span className="card-face-cost" aria-label={`コスト ${card.cost}`}>
            {card.cost}
          </span>
          <h3>{card.name}</h3>
        </header>
        <div className="card-artwork" aria-hidden="true">
          <span>{card.name.slice(0, 1)}</span>
        </div>
        <div className="card-type-line">
          {KIND_LABELS[card.kind]}・{colorLabel}
        </div>
        <p className="card-face-rules">{getRulesText(card)}</p>
        {card.kind === 'creature' ? (
          <dl className="card-face-stats">
            <div>
              <dt>攻</dt>
              <dd>{card.attack}</dd>
            </div>
            <div>
              <dt>防</dt>
              <dd>{card.defense}</dd>
            </div>
            <div>
              <dt>進</dt>
              <dd>{card.march}</dd>
            </div>
          </dl>
        ) : (
          <div className="card-face-kind-mark">{KIND_LABELS[card.kind]}</div>
        )}
      </div>
      {hasStatModifier && (
        <div className="card-stat-modifiers" aria-label="ステータス補正">
          {hasAttackModifier && (
            <span
              className="card-stat-modifier card-stat-modifier-attack"
              aria-label={`攻撃力補正 ${formatModifier(statModifier.attack)}`}
            >
              攻{formatModifier(statModifier.attack)}
            </span>
          )}
          {hasDefenseModifier && (
            <span
              className="card-stat-modifier card-stat-modifier-defense"
              aria-label={`防御力補正 ${formatModifier(statModifier.defense)}`}
            >
              防{formatModifier(statModifier.defense)}
            </span>
          )}
        </div>
      )}
      {showDetail &&
        createPortal(
          <div
            ref={detailRef}
            id={detailId}
            className={`card-detail-popover card-detail-${colorClass} card-detail-popover-${detailPosition?.placement ?? 'right'}`}
            role="tooltip"
            style={{
              top: detailPosition?.top ?? 0,
              left: detailPosition?.left ?? 0,
              visibility: detailPosition === null ? 'hidden' : 'visible',
            }}
          >
            <header className="card-title-row">
              <span className="card-color-cost">
                <span className="card-color">{colorLabel}</span>
                <span className="card-cost" aria-label={`コスト ${card.cost}`}>
                  {card.cost}
                </span>
              </span>
              <span className="card-kind">{KIND_LABELS[card.kind]}</span>
            </header>
            <h3>{card.name}</h3>
            {card.kind === 'creature' && (
              <dl className="card-stats">
                <div>
                  <dt>攻</dt>
                  <dd>{card.attack}</dd>
                </div>
                <div>
                  <dt>防</dt>
                  <dd>{card.defense}</dd>
                </div>
                <div>
                  <dt>進</dt>
                  <dd>{card.march}</dd>
                </div>
              </dl>
            )}
            <p className="card-rules">{getRulesText(card)}</p>
          </div>,
          document.body,
        )}
    </article>
  )
}

export default CardView
