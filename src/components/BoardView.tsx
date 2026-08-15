import type { Board, PlayerState } from '../game'

type BoardViewProps = {
  board: Board
  players: Record<PlayerState['id'], PlayerState>
}

const BoardView = ({ board, players }: BoardViewProps) => {
  const laneSlots = Math.max(5, board.creatures.length + 2)
  const slotWidth = 120
  const boardWidth = laneSlots * slotWidth
  const boardHeight = 220

  return (
    <section className="board-panel" aria-label="battlefield">
      <svg
        className="board-svg"
        viewBox={`0 0 ${boardWidth} ${boardHeight}`}
        role="img"
        aria-labelledby="board-title"
      >
        <title id="board-title">戦場</title>
        <line className="board-lane" x1="60" y1="110" x2={boardWidth - 60} y2="110" />
        <g className="player-anchor" transform="translate(36 74)">
          <rect width="72" height="72" rx="8" />
          <text x="36" y="42" textAnchor="middle">
            {players.playerA.name}
          </text>
        </g>
        <g className="player-anchor" transform={`translate(${boardWidth - 108} 74)`}>
          <rect width="72" height="72" rx="8" />
          <text x="36" y="42" textAnchor="middle">
            {players.playerB.name}
          </text>
        </g>
        {board.creatures.map((creature, index) => (
          <g key={creature.instanceId} className="creature-node" transform={`translate(${132 + index * 96} 74)`}>
            <rect width="72" height="72" rx="8" />
            <text x="36" y="42" textAnchor="middle">
              {creature.card.name}
            </text>
          </g>
        ))}
      </svg>
    </section>
  )
}

export default BoardView
