import type { PlayerState } from '../game'

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
    <div className="formation-slot">{player.formation?.name ?? '布陣'}</div>
  </aside>
)

export default PlayerPanel
