import type { PlayerState } from '../game'
import CardView from './CardView'

type PlayerPanelProps = {
  player: PlayerState
  align: 'left' | 'right'
}

const PlayerPanel = ({ player, align }: PlayerPanelProps) => (
  <aside className={`player-panel player-panel-${align}`} aria-label={player.name}>
    <h2>{player.name}</h2>
    <dl>
      <div>
        <dt>HP</dt>
        <dd>{player.hp}</dd>
      </div>
      <div>
        <dt>Mana</dt>
        <dd>{player.mana}</dd>
      </div>
      <div>
        <dt>Deck</dt>
        <dd>{player.deck.length}</dd>
      </div>
      <div>
        <dt>Discard</dt>
        <dd>{player.discard.length}</dd>
      </div>
    </dl>
    <div className="player-card-zones">
      <div className="card-zone">
        <span>山札 {player.deck.length}</span>
        <CardView card={player.deck[0] ?? null} compact faceDown label="Deck" />
      </div>
      <div className="card-zone">
        <span>捨て札 {player.discard.length}</span>
        <CardView card={player.discard.at(-1) ?? null} compact label="Discard" />
      </div>
      <div className="card-zone card-zone-wide">
        <span>布陣</span>
        <CardView card={player.formation} compact label="Formation" />
      </div>
    </div>
  </aside>
)

export default PlayerPanel
