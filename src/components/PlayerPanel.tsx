import type { CardInstance, CardInstanceId, PlayerState } from '../game'
import CardView from './CardView'

type PlayerPanelProps = {
  player: PlayerState
  cards: Record<CardInstanceId, CardInstance>
  align: 'left' | 'right'
  damage?: number | null
}

const PlayerPanel = ({ player, cards, align, damage = null }: PlayerPanelProps) => (
  <aside className={`player-panel player-panel-${align}`} aria-label={player.name}>
    <h2>{player.name}</h2>
    <dl>
      <div className="player-hp-stat">
        <dt>HP</dt>
        <dd>{player.hp}</dd>
        {damage !== null && (
          <span
            className="damage-marker player-damage-marker"
            role="status"
            aria-label={`プレイヤーに${damage}ダメージ`}
          >
            {damage}
          </span>
        )}
      </div>
      <div>
        <dt>Mana</dt>
        <dd>{player.mana}</dd>
      </div>
    </dl>
    <div className="player-card-zones">
      <div className="card-zone card-zone-wide">
        <span>布陣</span>
        <CardView
          card={player.formation === null ? null : cards[player.formation].card}
          compact
          label="Formation"
        />
      </div>
    </div>
  </aside>
)

export default PlayerPanel
