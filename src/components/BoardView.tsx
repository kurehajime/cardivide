import { Fragment, useEffect, type CSSProperties } from 'react'
import { motion, useAnimationControls } from 'motion/react'
import type {
  ActivatedAbilityOption,
  Board,
  CardInstance,
  CardInstanceId,
  DamageMarker,
  EffectiveBoardGroup,
  CreatureStatModifier,
  PlayerId,
  PlayerState,
  SummonOption,
} from '../game'
import CardView from './CardView'
import GraveyardSummary from './GraveyardSummary'

export type BoardAttackAnimation = {
  id: number
  ownerId: PlayerId
  startIndex: number
  endIndex: number
}

type BoardViewProps = {
  board: Board
  cards: Record<CardInstanceId, CardInstance>
  damageMarkers?: DamageMarker[]
  destroyedCardIds?: CardInstanceId[]
  playerDamageMarker?: { playerId: PlayerId; damage: number } | null
  players: Record<PlayerState['id'], PlayerState>
  activePlayerId: PlayerId
  groups: EffectiveBoardGroup[]
  creatureStatModifiers: Record<CardInstanceId, CreatureStatModifier>
  summonOptions?: SummonOption[]
  activatedAbilities?: ActivatedAbilityOption[]
  attackAnimation?: BoardAttackAnimation | null
  canAttack?: boolean
  onInsertClick?: (insertIndex: number) => void
  onGroupAttack?: (startIndex: number, endIndex: number) => void
  onActivateAbility?: (ability: ActivatedAbilityOption) => void
}

type BoardPlayerProps = {
  player: PlayerState
  cards: Record<CardInstanceId, CardInstance>
  damage: number | null
}

type SummonSlotState = 'available' | 'reachable' | 'unreachable'

const DAMAGE_MARKER_STYLE = {
  '--damage-marker-icon': `url("${import.meta.env.BASE_URL}damage.svg")`,
} as CSSProperties

const getSummonSlotState = (option?: SummonOption): SummonSlotState | null => {
  if (!option) {
    return null
  }
  if (!option.canReach) {
    return 'unreachable'
  }
  return option.affordable ? 'available' : 'reachable'
}

const getSummonSlotClassName = (option?: SummonOption, empty = false): string => {
  const state = getSummonSlotState(option)
  return [
    'board-insert-slot',
    empty ? 'board-insert-slot-empty' : '',
    state ? `board-insert-slot-${state}` : '',
  ]
    .filter(Boolean)
    .join(' ')
}

const getSummonSlotTitle = (option?: SummonOption): string | undefined => {
  if (!option) {
    return undefined
  }
  if (!option.canReach) {
    return `進軍不可 / 必要進軍 ${option.requiredMarch}`
  }
  if (!option.affordable) {
    return `進軍可能 / コスト ${option.effectiveCost}（マナ不足）`
  }
  return `進軍可能 / コスト ${option.effectiveCost}`
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
    <motion.div
      className="board-endpoint"
      data-player-id={player.id}
      initial={false}
      animate={
        damage !== null && damage >= 1
          ? {
              x: [0, -8, 7, -5, 4, -2, 0],
              y: [0, 1, -1, 1, -1, 0, 0],
            }
          : { x: 0, y: 0 }
      }
      transition={{ duration: 0.34, ease: 'easeInOut' }}
    >
      {player.name}
      {damage !== null && (
        <span
          className="damage-marker player-damage-marker"
          role="status"
          aria-label={`プレイヤーに${damage}ダメージ`}
          style={DAMAGE_MARKER_STYLE}
        >
          {damage}
        </span>
      )}
    </motion.div>
    <GraveyardSummary player={player} cards={cards} />
    <div className="board-spell" aria-label={`${player.name} spell`}>
      <CardView
        card={
          player.placedSpell === null
            ? null
            : cards[player.placedSpell.cardId].card
        }
        compact
        label="魔法"
      />
    </div>
  </section>
)

type BoardGroupButtonProps = {
  group: EffectiveBoardGroup
  activePlayerId: PlayerId
  animationId: number | null
  canAttack: boolean
  onAttack?: (startIndex: number, endIndex: number) => void
}

const BoardGroupButton = ({
  group,
  activePlayerId,
  animationId,
  canAttack,
  onAttack,
}: BoardGroupButtonProps) => {
  const animationControls = useAnimationControls()
  const pokeDistance = group.ownerId === 'playerA' ? 10 : -10

  useEffect(() => {
    if (animationId === null) {
      return
    }

    void animationControls.start({
      x: [0, pokeDistance, 0],
      transition: { duration: 0.2, times: [0, 0.4, 1], ease: 'easeOut' },
    })
  }, [animationControls, animationId, pokeDistance])

  return (
    <motion.button
      className={`board-group-button board-group-${group.ownerId}`}
      style={{
        gridColumn: `${group.startIndex * 2 + 2} / ${group.endIndex * 2 + 3}`,
        gridRow: group.ownerId === 'playerB' ? 1 : 3,
      }}
      animate={animationControls}
      type="button"
      disabled={!canAttack || activePlayerId !== group.ownerId}
      onClick={() => onAttack?.(group.startIndex, group.endIndex)}
    >
      攻{group.attack} / 防{group.defense}
    </motion.button>
  )
}

const BoardView = ({
  board,
  cards,
  damageMarkers = [],
  destroyedCardIds = [],
  playerDamageMarker = null,
  players,
  activePlayerId,
  groups,
  creatureStatModifiers,
  summonOptions = [],
  activatedAbilities = [],
  attackAnimation = null,
  canAttack = false,
  onInsertClick,
  onGroupAttack,
  onActivateAbility,
}: BoardViewProps) => {
  const damageByCardId = new Map(
    damageMarkers.map(({ cardId, damage }) => [cardId, damage]),
  )
  const destroyedCardIdSet = new Set(destroyedCardIds)
  const summonOptionByIndex = new Map(
    summonOptions.map((option) => [option.insertIndex, option]),
  )
  const firstSummonOption = summonOptionByIndex.get(0)
  const lastSummonOption = summonOptionByIndex.get(board.creatures.length)
  const abilitiesByCardId = new Map<CardInstanceId, ActivatedAbilityOption[]>()
  activatedAbilities.forEach((ability) => {
    abilitiesByCardId.set(ability.sourceCardId, [
      ...(abilitiesByCardId.get(ability.sourceCardId) ?? []),
      ability,
    ])
  })
  const gridTemplateColumns =
    board.creatures.length === 0
      ? 'minmax(140px, 1fr)'
      : `34px ${board.creatures.map(() => '140px 34px').join(' ')}`

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
              className={getSummonSlotClassName(firstSummonOption, true)}
              data-summon-state={getSummonSlotState(firstSummonOption) ?? undefined}
              type="button"
              disabled={!firstSummonOption?.canSummon}
              title={getSummonSlotTitle(firstSummonOption)}
              onClick={() => onInsertClick?.(0)}
            >
              配置
            </button>
          </div>
        ) : (
          <div className="board-lane-grid" style={{ gridTemplateColumns }}>
            {board.creatures.map((creature, index) => {
              const summonOption = summonOptionByIndex.get(index)
              return (
                <Fragment key={creature.cardId}>
                <button
                  key={`insert-${index}`}
                  className={getSummonSlotClassName(summonOption)}
                  data-summon-state={getSummonSlotState(summonOption) ?? undefined}
                  style={{ gridColumn: index * 2 + 1, gridRow: 2 }}
                  type="button"
                  disabled={!summonOption?.canSummon}
                  title={getSummonSlotTitle(summonOption)}
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
                  <motion.div
                    className="board-card-content"
                    initial={false}
                    animate={{ scale: destroyedCardIdSet.has(creature.cardId) ? 0 : 1 }}
                    transition={
                      destroyedCardIdSet.has(creature.cardId)
                        ? { delay: 0.12, duration: 0.3, ease: [0.4, 0, 0.6, 1] }
                        : { duration: 0.15 }
                    }
                  >
                    <CardView
                      card={cards[creature.cardId].card}
                      compact
                      statModifier={creatureStatModifiers[creature.cardId]}
                    />
                  </motion.div>
                  {(abilitiesByCardId.get(creature.cardId) ?? []).length > 0 && (
                    <div className="board-ability-actions">
                      {(abilitiesByCardId.get(creature.cardId) ?? []).map((ability) => (
                        <button
                          key={ability.abilityType}
                          type="button"
                          disabled={!ability.enabled}
                          title={ability.reason}
                          onClick={() => onActivateAbility?.(ability)}
                        >
                          {ability.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {damageByCardId.has(creature.cardId) && (
                    <span
                      className="damage-marker card-damage-marker"
                      role="status"
                      aria-label={`${damageByCardId.get(creature.cardId)}ダメージ`}
                      style={DAMAGE_MARKER_STYLE}
                    >
                      {damageByCardId.get(creature.cardId)}
                    </span>
                  )}
                </motion.div>
                </Fragment>
              )
            })}
            <button
              className={getSummonSlotClassName(lastSummonOption)}
              data-summon-state={getSummonSlotState(lastSummonOption) ?? undefined}
              style={{ gridColumn: board.creatures.length * 2 + 1, gridRow: 2 }}
              type="button"
              disabled={!lastSummonOption?.canSummon}
              title={getSummonSlotTitle(lastSummonOption)}
              onClick={() => onInsertClick?.(board.creatures.length)}
            >
              +
            </button>
            {groups.map((group) => (
              <BoardGroupButton
                key={`group-${group.startIndex}-${group.endIndex}`}
                group={group}
                activePlayerId={activePlayerId}
                animationId={
                  attackAnimation?.ownerId === group.ownerId &&
                  attackAnimation.startIndex === group.startIndex &&
                  attackAnimation.endIndex === group.endIndex
                    ? attackAnimation.id
                    : null
                }
                canAttack={canAttack}
                onAttack={onGroupAttack}
              />
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
