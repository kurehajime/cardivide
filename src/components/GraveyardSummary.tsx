import type {
  CardColor,
  CardInstance,
  CardInstanceId,
  PlayerState,
} from '../game'

type GraveyardSummaryProps = {
  player: PlayerState
  cards: Record<CardInstanceId, CardInstance>
}

const GRAVEYARD_ICON_URL = `${import.meta.env.BASE_URL}trash_aria.svg`
const CARD_COLORS: readonly CardColor[] = ['red', 'blue', 'green']
const COLOR_LABELS: Record<CardColor, string> = {
  red: '赤',
  blue: '青',
  green: '緑',
}

const GraveyardSummary = ({ player, cards }: GraveyardSummaryProps) => {
  const creatureCounts: Record<CardColor, number> = {
    red: 0,
    blue: 0,
    green: 0,
  }

  player.discard.forEach((cardId) => {
    const card = cards[cardId]?.card
    if (card?.kind === 'creature') {
      creatureCounts[card.color] += 1
    }
  })

  return (
    <div className="graveyard-summary" aria-label={`${player.name}の墓地`}>
      <img className="graveyard-icon" src={GRAVEYARD_ICON_URL} alt="" />
      <div className="graveyard-counts" role="list">
        {CARD_COLORS.map((color) => (
          <span
            className={`graveyard-count graveyard-count-${color}`}
            role="listitem"
            aria-label={`${COLOR_LABELS[color]}のクリーチャー${creatureCounts[color]}枚`}
            title={`${COLOR_LABELS[color]}のクリーチャー: ${creatureCounts[color]}枚`}
            key={color}
          >
            {creatureCounts[color]}
          </span>
        ))}
      </div>
    </div>
  )
}

export default GraveyardSummary
