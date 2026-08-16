import { Fragment } from 'react'
import { motion } from 'motion/react'
import type {
  Board,
  CardInstance,
  CardInstanceId,
  DamageMarker,
  PlayerId,
  PlayerState,
} from '../game'
import CardView from './CardView'

type BoardViewProps = {
  board: Board
  cards: Record<CardInstanceId, CardInstance>
  damageMarkers?: DamageMarker[]
  playerDamageMarker?: { playerId: PlayerId; damage: number } | null
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

type BoardPlayerProps = {
  player: PlayerState
  cards: Record<CardInstanceId, CardInstance>
  damage: number | null
}

const BoardPlayer = ({ player, cards, damage }: BoardPlayerProps) => (
  <section className="board-player" aria-label={`${player.name} field`}>
    <dl className="board-player-stats">
      <div>
        <dt>HP</dt>
        <dd>{player.hp}</dd>
      </div>
      <div>
        <dt>Mana</dt>
        <dd>{player.mana}</dd>
      </div>
    </dl>
    <div className="board-endpoint" data-player-id={player.id}>
      {player.name}
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
    <div className="board-formation" aria-label={`${player.name} formation`}>
      <CardView
        card={player.formation === null ? null : cards[player.formation].card}
        compact
        label="布陣"
      />
    </div>
  </section>
)

const collectGroups = (
  board: Board,
  cards: Record<CardInstanceId, CardInstance>,
): BoardGroup[] => {
  const groups: BoardGroup[] = []
  let index = 0

  while (index < board.creatures.length) {
    const ownerId = cards[board.creatures[index].cardId].ownerId
    const startIndex = index
    while (
      index + 1 < board.creatures.length &&
      cards[board.creatures[index + 1].cardId].ownerId === ownerId
    ) {
      index += 1
    }
    const groupCreatures = board.creatures.slice(startIndex, index + 1)
    groups.push({
      ownerId,
      startIndex,
      endIndex: index,
      attack: groupCreatures.reduce((total, creature) => {
        const card = cards[creature.cardId].card
        return total + (card.kind === 'creature' ? card.attack : 0)
      }, 0),
      defense: groupCreatures.reduce((total, creature) => {
        const card = cards[creature.cardId].card
        return total + (card.kind === 'creature' ? card.defense : 0)
      }, 0),
    })
    index += 1
  }

  return groups
}

const BoardView = ({
  board,
  cards,
  damageMarkers = [],
  playerDamageMarker = null,
  players,
  activePlayerId,
  canInsert = false,
  canAttack = false,
  onInsertClick,
  onGroupAttack,
}: BoardViewProps) => {
  const groups = collectGroups(board, cards)
  const damageByCardId = new Map(
    damageMarkers.map(({ cardId, damage }) => [cardId, damage]),
  )
  const gridTemplateColumns =
    board.creatures.length === 0
      ? 'minmax(140px, 1fr)'
      : `34px ${board.creatures.map(() => '116px 34px').join(' ')}`

  return (
    <section className="board-panel" aria-label="battlefield">
      <BoardPlayer
        player={players.playerA}
        cards={cards}
        damage={playerDamageMarker?.playerId === 'playerA' ? playerDamageMarker.damage : null}
      />
      <motion.div className="board-lane-scroll" layoutScroll>
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
              <Fragment key={creature.cardId}>
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
                <motion.div
                  layout
                  layoutId={`card-${creature.cardId}`}
                  data-card-id={creature.cardId}
                  className="board-slot"
                  style={{ gridColumn: index * 2 + 2, gridRow: 2 }}
                >
                  <CardView card={cards[creature.cardId].card} compact />
                  {damageByCardId.has(creature.cardId) && (
                    <span
                      className="damage-marker card-damage-marker"
                      role="status"
                      aria-label={`${damageByCardId.get(creature.cardId)}ダメージ`}
                    >
                      {damageByCardId.get(creature.cardId)}
                    </span>
                  )}
                </motion.div>
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
      </motion.div>
      <BoardPlayer
        player={players.playerB}
        cards={cards}
        damage={playerDamageMarker?.playerId === 'playerB' ? playerDamageMarker.damage : null}
      />
    </section>
  )
}

export default BoardView
