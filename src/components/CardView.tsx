import { formatAbility, type Card, type CreatureStatModifier } from '../game'

type CardViewProps = {
  card: Card | null
  compact?: boolean
  faceDown?: boolean
  label?: string
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

const getRulesText = (card: Card): string => {
  if (card.kind === 'creature') {
    return card.abilities.length > 0 ? card.abilities.map(formatAbility).join(' / ') : '能力なし'
  }
  return card.text
}

const CardView = ({
  card,
  compact = false,
  faceDown = false,
  label,
  statModifier,
}: CardViewProps) => {
  if (!card || faceDown) {
    return (
      <article className={`card-view card-empty ${compact ? 'card-compact' : ''}`}>
        <div className="card-back-pattern" aria-hidden="true" />
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
      className={`card-view card-${colorClass} ${compact ? 'card-compact' : ''} ${hasStatModifier ? 'card-with-stat-modifiers' : ''}`}
    >
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
    </article>
  )
}

export default CardView
