import type { Board, PlayerState } from '../game'
import CardView from './CardView'

type BoardViewProps = {
  board: Board
  players: Record<PlayerState['id'], PlayerState>
}

const BoardView = ({ board, players }: BoardViewProps) => {
  const laneCards = board.creatures.length > 0
    ? board.creatures.map((creature) => creature.card)
    : Array.from({ length: 5 }, () => null)

  return (
    <section className="board-panel" aria-label="battlefield">
      <div className="board-endpoint">{players.playerA.name}</div>
      <div className="board-lane-cards">
        {laneCards.map((card, index) => (
          <div key={card?.id ?? `empty-board-${index}`} className="board-slot">
            <CardView card={card} compact />
          </div>
        ))}
      </div>
      <div className="board-endpoint">{players.playerB.name}</div>
    </section>
  )
}

export default BoardView
