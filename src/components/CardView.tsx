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

const formatModifier = (value: number): string => `${value > 0 ? '+' : ''}${value}`

type CardFaceProps = {
  card: Card
  colorLabel: string
  statModifier?: CreatureStatModifier
}

const CardFace = ({ card, colorLabel, statModifier }: CardFaceProps) => {
  const hasAttackModifier = statModifier !== undefined && statModifier.attack !== 0
  const hasDefenseModifier = statModifier !== undefined && statModifier.defense !== 0
  const modifiers: Array<{ label: string; type: 'attack' | 'defense' }> = []
  if (hasAttackModifier) {
    modifiers.push({ label: `攻${formatModifier(statModifier.attack)}`, type: 'attack' })
  }
  if (hasDefenseModifier) {
    modifiers.push({ label: `防${formatModifier(statModifier.defense)}`, type: 'defense' })
  }

  return (
    <svg
      className="card-face"
      viewBox="0 0 500 700"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <rect className="card-face-base" x="2" y="2" width="496" height="696" rx="18" />
      <rect className="card-face-outline" x="6" y="6" width="488" height="688" rx="16" />

      <circle className="card-face-cost-circle" cx="55" cy="54" r="40" />
      <text className="card-face-cost-text" x="55" y="57">
        {card.cost}
      </text>
      <foreignObject x="110" y="17" width="365" height="75">
        <div className="card-face-name">{card.name}</div>
      </foreignObject>

      <rect className="card-face-art-frame" x="25" y="105" width="450" height="265" rx="12" />
      <circle className="card-face-art-seal" cx="250" cy="237" r="72" />
      <text className="card-face-art-letter" x="250" y="245">
        {card.name.slice(0, 1)}
      </text>

      {modifiers.map((modifier, index) => (
        <g
          key={modifier.type}
          className={`card-face-modifier card-face-modifier-${modifier.type}`}
          transform={`translate(${modifiers.length === 1 ? 430 : 382 + index * 82} 150)`}
        >
          <circle r="34" />
          <text y="3">{modifier.label}</text>
        </g>
      ))}

      <rect className="card-face-type-band" x="25" y="385" width="450" height="48" rx="8" />
      <text className="card-face-type-text" x="45" y="410">
        {KIND_LABELS[card.kind]}・{colorLabel}
      </text>

      <rect className="card-face-rules-frame" x="25" y="447" width="450" height="175" rx="10" />
      <foreignObject x="43" y="463" width="414" height="143">
        <div className="card-face-rules">{getRulesText(card)}</div>
      </foreignObject>

      {card.kind === 'creature' ? (
        <g className="card-face-stats">
          {[
            { label: '攻', value: card.attack, x: 25 },
            { label: '防', value: card.defense, x: 180 },
            { label: '進', value: card.march, x: 335 },
          ].map(({ label, value, x }) => (
            <g key={label} transform={`translate(${x} 637)`}>
              <rect width="140" height="45" rx="8" />
              <text className="card-face-stat-label" x="25" y="24">
                {label}
              </text>
              <text className="card-face-stat-value" x="108" y="24">
                {value}
              </text>
            </g>
          ))}
        </g>
      ) : (
        <g className="card-face-kind-mark">
          <rect x="25" y="637" width="450" height="45" rx="8" />
          <text x="250" y="661">
            {KIND_LABELS[card.kind]}
          </text>
        </g>
      )}
    </svg>
  )
}

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
  const modifierLabel = [
    hasAttackModifier ? `攻撃力補正${formatModifier(statModifier.attack)}` : null,
    hasDefenseModifier ? `防御力補正${formatModifier(statModifier.defense)}` : null,
  ]
    .filter((modifier): modifier is string => modifier !== null)
    .join('、')

  return (
    <article
      ref={cardRef}
      className={`card-view card-${colorClass} ${compact ? 'card-compact' : ''}`}
      aria-describedby={showDetail ? detailId : undefined}
      aria-label={`${card.name}${hasStatModifier ? `、${modifierLabel}` : ''}`}
      tabIndex={nestedInButton ? undefined : 0}
      onBlur={closeDetail}
      onFocus={openDetail}
      onPointerEnter={openDetail}
      onPointerLeave={closeDetail}
    >
      <CardFace card={card} colorLabel={colorLabel} statModifier={statModifier} />
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
