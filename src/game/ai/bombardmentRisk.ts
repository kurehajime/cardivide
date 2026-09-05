import { CreatureRules } from '../CreatureRules'
import { GameManager } from '../GameManager'
import { getCreatureOwnerAt, getOpponentId } from '../boardQueries'
import type { PlayerId } from '../types'

export const BOMBARDMENT_SUMMON_RISK = {
  attack: 3,
  march: 1,
  exposedMultiplier: 0.1,
} as const

// A single ordinary summon is a risk estimate, not another search branch.
export const estimateBombardment = (
  manager: GameManager,
  ownerId: PlayerId,
): { damage: number; protectedDamage: number } => {
  const { state } = manager
  const enemyId = getOpponentId(ownerId)
  const enemy = state.players[enemyId]
  const canHaveReinforcements = enemy.hand.length + enemy.deck.length > 0
  const direction = ownerId === 'playerA' ? 1 : -1
  const reachable: (boolean | undefined)[] = []
  let damage = 0
  let protectedDamage = 0

  for (let index = 0; index < state.board.creatures.length; index += 1) {
    if (getCreatureOwnerAt(state, index) !== ownerId) continue
    const contribution = new CreatureRules(state, index).getKeepUpPlayerDamage()
    if (contribution === 0) continue

    let exposed = false
    let defense = 0
    for (
      let front = index;
      canHaveReinforcements && front >= 0 && front < state.board.creatures.length &&
        getCreatureOwnerAt(state, front) === ownerId;
      front += direction
    ) {
      defense += new CreatureRules(state, front).getEffectiveStats().defense
      if (defense > BOMBARDMENT_SUMMON_RISK.attack) break
      const insertIndex = ownerId === 'playerA' ? front + 1 : front
      reachable[insertIndex] ??= GameManager.getRequiredMarchForInsert(
        manager, enemyId, insertIndex,
      ) <= BOMBARDMENT_SUMMON_RISK.march
      if (reachable[insertIndex]) {
        exposed = true
        break
      }
    }
    damage += contribution * (exposed ? BOMBARDMENT_SUMMON_RISK.exposedMultiplier : 1)
    if (!exposed) protectedDamage += contribution
  }
  return { damage, protectedDamage }
}
