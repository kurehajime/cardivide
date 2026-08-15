import { Fragment } from 'react'
import type { Board, PlayerId, PlayerState } from '../game'
import CardView from './CardView'

type BoardViewProps = {
  board: Board
  players: Record<PlayerState['id'], PlayerState>
  activePlayerId: PlayerId
  canInsert?: boolean
  canAttack?: boolean
  onInsertClick?: (insertIndex: number) => void
  onGroupAttack?: (startIndex: number, endIndex: number) => void
}

type BoardGroup = {
  ownerId: PlayerId
  startIndex: number
  endIndex: number
  attack: number
  defense: number
}

const collectGroups = (board: Board): BoardGroup[] => {
  const groups: BoardGroup[] = []
  let index = 0

  while (index < board.creatures.length) {
    const ownerId = board.creatures[index].ownerId
    const startIndex = index
    while (
      index + 1 < board.creatures.length &&
      board.creatures[index + 1].ownerId === ownerId
    ) {
      index += 1
    }
    const groupCreatures = board.creatures.slice(startIndex, index + 1)
    groups.push({
      ownerId,
      startIndex,
      endIndex: index,
      attack: groupCreatures.reduce((total, creature) => total + creature.card.attack, 0),
      defense: groupCreatures.reduce((total, creature) => total + creature.card.defense, 0),
    })
    index += 1
  }

  return groups
}

const BoardView = ({
  board,
  players,
  activePlayerId,
  canInsert = false,
  canAttack = false,
  onInsertClick,
  onGroupAttack,
}: BoardViewProps) => {
  const groups = collectGroups(board)
  const gridTemplateColumns =
    board.creatures.length === 0
      ? 'minmax(140px, 1fr)'
      : `34px ${board.creatures.map(() => '116px 34px').join(' ')}`

  return (
    <section className="board-panel" aria-label="battlefield">
      <div className="board-endpoint">{players.playerA.name}</div>
      <div className="board-lane-scroll">
        {board.creatures.length === 0 ? (
          <div className="board-lane-grid" style={{ gridTemplateColumns }}>
            <button
              className="board-insert-slot board-insert-slot-empty"
              type="button"
              disabled={!canInsert}
              onClick={() => onInsertClick?.(0)}
            >
              配置
            </button>
          </div>
        ) : (
          <div className="board-lane-grid" style={{ gridTemplateColumns }}>
            {board.creatures.map((creature, index) => (
              <Fragment key={creature.instanceId}>
                <button
                  key={`insert-${index}`}
                  className="board-insert-slot"
                  style={{ gridColumn: index * 2 + 1, gridRow: 2 }}
                  type="button"
                  disabled={!canInsert}
                  onClick={() => onInsertClick?.(index)}
                >
                  +
                </button>
                <div
                  key={creature.instanceId}
                  className="board-slot"
                  style={{ gridColumn: index * 2 + 2, gridRow: 2 }}
                >
                  <CardView card={creature.card} compact />
                </div>
              </Fragment>
            ))}
            <button
              className="board-insert-slot"
              style={{ gridColumn: board.creatures.length * 2 + 1, gridRow: 2 }}
              type="button"
              disabled={!canInsert}
              onClick={() => onInsertClick?.(board.creatures.length)}
            >
              +
            </button>
            {groups.map((group) => (
              <button
                key={`group-${group.startIndex}-${group.endIndex}`}
                className={`board-group-button board-group-${group.ownerId}`}
                style={{
                  gridColumn: `${group.startIndex * 2 + 2} / ${group.endIndex * 2 + 3}`,
                  gridRow: group.ownerId === 'playerB' ? 1 : 3,
                }}
                type="button"
                disabled={!canAttack || activePlayerId !== group.ownerId}
                onClick={() => onGroupAttack?.(group.startIndex, group.endIndex)}
              >
                攻{group.attack} / 防{group.defense}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="board-endpoint">{players.playerB.name}</div>
    </section>
  )
}

export default BoardView
