import {
  countOwnerGroupsContainingColor,
  findCreatureIndex,
  getCreatureAt,
  getCreatureCardAt,
  getCreatureOwnerAt,
  getFrontIndex,
  getGroupAt,
  getRearNeighborIndex,
  isAdjacentToEnemyPlayer,
  isCreatureFlankedByEnemies,
  isGroupFlankedByEnemies,
} from './boardQueries'
import type {
  ActivatedAbilityOption,
  ActivatedAbilityResolution,
  ActivatedAbilityType,
  CardInstanceId,
  CreatureCard,
  CreatureStatModifier,
  EffectiveCreatureStats,
  GameState,
  KeepUpManaContribution,
  KeywordAbility,
  KeywordAbilityType,
  PlayerId,
} from './types'

const RED_FORMATION_ID = 'red-cost3-formation'
const BLUE_FORMATION_ID = 'blue-cost3-formation'
const GREEN_FORMATION_ID = 'green-cost3-formation'
const NO_STAT_MODIFIER: CreatureStatModifier = { attack: 0, defense: 0 }

type AbilityByType<T extends KeywordAbilityType> = Extract<KeywordAbility, { type: T }>

type CreatureRuleContext = {
  state: GameState
  boardIndex: number
  cardId: CardInstanceId
  card: CreatureCard
  ownerId: PlayerId
}

type AbilityHandler<TAbility extends KeywordAbility = KeywordAbility> = {
  getAttackOverride?: (
    ability: TAbility,
    context: CreatureRuleContext,
  ) => number | null
  getPositionStatModifier?: (
    ability: TAbility,
    context: CreatureRuleContext,
  ) => CreatureStatModifier
  getKeepUpManaContribution?: (
    ability: TAbility,
    context: CreatureRuleContext,
  ) => KeepUpManaContribution | null
  getSummonCostModifier?: (
    ability: TAbility,
    context: CreatureRuleContext,
    summoningPlayerId: PlayerId,
    insertIndex: number,
  ) => number
  getOpponentMarchCost?: (
    ability: TAbility,
    context: CreatureRuleContext,
    movingPlayerId: PlayerId,
  ) => number
  getActivatedAbility?: (
    ability: TAbility,
    context: CreatureRuleContext,
  ) => ActivatedAbilityOption
  getActivatedResolution?: (
    ability: TAbility,
    context: CreatureRuleContext,
  ) => ActivatedAbilityResolution
  preventsDestructionRefund?: boolean
}

type AbilityHandlerMap = {
  [TAbility in KeywordAbilityType]: AbilityHandler<AbilityByType<TAbility>>
}

const createActivatedOption = (
  context: CreatureRuleContext,
  abilityType: ActivatedAbilityType,
  label: string,
  condition: boolean,
  reason: string,
): ActivatedAbilityOption => {
  const isActiveCreature =
    context.state.phase === 'main' &&
    context.state.pendingCombat === null &&
    context.state.activePlayerId === context.ownerId
  return {
    sourceCardId: context.cardId,
    abilityType,
    label,
    enabled: isActiveCreature && condition,
    ...(!isActiveCreature
      ? { reason: '自分のメインフェイズに使用できます。' }
      : condition
        ? {}
        : { reason }),
  }
}

const ABILITY_HANDLERS = {
  summoningSickness: {
    getAttackOverride: (_ability, context) =>
      getCreatureAt(context.state, context.boardIndex).summonedTurn ===
      context.state.turn
        ? 0
        : null,
  },
  vanish: {
    preventsDestructionRefund: true,
  },
  loneWarrior: {
    getPositionStatModifier: (ability, context) =>
      isCreatureFlankedByEnemies(context.state, context.boardIndex)
        ? { attack: ability.attack, defense: ability.defense }
        : NO_STAT_MODIFIER,
  },
  withdraw: {
    getActivatedAbility: (_ability, context) =>
      createActivatedOption(context, 'withdraw', '撤去', true, ''),
    getActivatedResolution: (_ability, context) => ({
      destination: 'discard',
      mana: context.card.cost,
    }),
  },
  assassin: {
    getPositionStatModifier: (ability, context) =>
      isAdjacentToEnemyPlayer(context.state, context.boardIndex)
        ? { attack: ability.attack, defense: 0 }
        : NO_STAT_MODIFIER,
  },
  counter: {},
  return: {
    getActivatedAbility: (_ability, context) => {
      const handHasRoom = context.state.players[context.ownerId].hand.length <= 4
      return createActivatedOption(
        context,
        'return',
        '帰還',
        handHasRoom,
        '手札が5枚あるため帰還できません。',
      )
    },
    getActivatedResolution: (_ability, context) => ({
      destination: 'hand',
      mana: Math.floor(context.card.cost / 2),
    }),
  },
  beachhead: {
    getSummonCostModifier: (ability, context, summoningPlayerId, insertIndex) => {
      const isAdjacentInsert =
        insertIndex === context.boardIndex || insertIndex === context.boardIndex + 1
      return summoningPlayerId === context.ownerId &&
        isAdjacentInsert &&
        isCreatureFlankedByEnemies(context.state, context.boardIndex)
        ? -ability.costReduction
        : 0
    },
  },
  capture: {
    getOpponentMarchCost: (ability, context, movingPlayerId) =>
      movingPlayerId === context.ownerId ? 0 : ability.marchTax,
  },
  mining: {
    getKeepUpManaContribution: (ability, context) => {
      const group = getGroupAt(context.state, context.boardIndex)
      if (!isGroupFlankedByEnemies(context.state, group)) {
        return null
      }
      return {
        amount: ability.mana,
        stackKey: `mining:${group.startIndex}-${group.endIndex}`,
      }
    },
  },
  rearguard: {
    getPositionStatModifier: (ability, context) => {
      const rearIndex = getRearNeighborIndex(context.state, context.boardIndex)
      return rearIndex !== null &&
        getCreatureOwnerAt(context.state, rearIndex) !== context.ownerId
        ? { attack: ability.attack, defense: ability.defense }
        : NO_STAT_MODIFIER
    },
  },
} satisfies AbilityHandlerMap

const getAbilityHandler = (ability: KeywordAbility): AbilityHandler =>
  ABILITY_HANDLERS[ability.type] as AbilityHandler

const getFormationDefinitionId = (
  state: GameState,
  ownerId: PlayerId,
): string | null => {
  const formationId = state.players[ownerId].formation
  return formationId === null ? null : state.cards[formationId].card.definitionId
}

export const formatAbility = (ability: KeywordAbility): string => {
  switch (ability.type) {
    case 'summoningSickness':
      return '召喚酔い'
    case 'vanish':
      return '消滅'
    case 'loneWarrior':
      return `一騎当千(+${ability.attack}/+${ability.defense})`
    case 'withdraw':
      return '撤去'
    case 'assassin':
      return `刺客${ability.attack}`
    case 'counter':
      return '反撃'
    case 'return':
      return '帰還'
    case 'beachhead':
      return `橋頭堡${ability.costReduction}`
    case 'capture':
      return `捕獲${ability.marchTax}`
    case 'mining':
      return `採掘${ability.mana}`
    case 'rearguard':
      return `しんがり(+${ability.attack}/+${ability.defense})`
  }
}

export const describeAbility = (ability: KeywordAbility): string => {
  switch (ability.type) {
    case 'summoningSickness':
      return '召喚したターンは攻撃力0として扱う。'
    case 'vanish':
      return 'このクリーチャーが破壊された場合、通常の破壊によるマナ返還は発生しない。'
    case 'loneWarrior':
      return `このクリーチャーの両隣が敵クリーチャーまたは敵プレイヤーの場合、攻撃力+${ability.attack}、防御力+${ability.defense}する。`
    case 'withdraw':
      return '起動型能力。このクリーチャーを場から捨て札に置く。そうした場合、このクリーチャーのコストに等しいマナを得る。撤去で捨て札に置かれたクリーチャーは破壊されたものとして扱わない。'
    case 'assassin':
      return `このクリーチャーの隣が敵プレイヤーの場合、攻撃力を+${ability.attack}する。`
    case 'counter':
      return 'このクリーチャーが先頭にいる場合、攻撃グループの先頭にいるクリーチャー1体へ、自身の攻撃力と同じ攻撃を与える。通常の攻撃と反撃は同時に解決する。'
    case 'return':
      return '起動型能力。手札が4枚以下のとき、このクリーチャーを手札に戻す。半分のコストが戻ってくる。'
    case 'beachhead':
      return `このクリーチャーの両隣が敵クリーチャーまたは敵プレイヤーの場合、このクリーチャーの隣に召喚する味方のコストは${ability.costReduction}減少する。`
    case 'capture':
      return `このクリーチャーを越える際、必要進軍距離を+${ability.marchTax}する。`
    case 'mining':
      return `このクリーチャーが所属するグループの両側に敵クリーチャーまたは敵プレイヤーが隣接している場合、自分のキープアップフェイズに追加で${ability.mana}マナを得る。同じグループで複数の《採掘》が有効な場合、最も大きい数値だけを適用する。`
    case 'rearguard':
      return `このクリーチャーの後方に敵クリーチャーが隣接する場合、攻撃力+${ability.attack}、防御力+${ability.defense}する。`
  }
}

export class CreatureRules {
  private readonly context: CreatureRuleContext

  constructor(state: GameState, boardIndex: number) {
    const creature = getCreatureAt(state, boardIndex)
    const card = getCreatureCardAt(state, boardIndex)
    this.context = {
      state,
      boardIndex,
      cardId: creature.cardId,
      card,
      ownerId: getCreatureOwnerAt(state, boardIndex),
    }
  }

  static fromCardId(state: GameState, cardId: CardInstanceId): CreatureRules {
    const boardIndex = findCreatureIndex(state, cardId)
    if (boardIndex < 0) {
      throw new Error(`Creature card ${cardId} is not on the board.`)
    }
    return new CreatureRules(state, boardIndex)
  }

  get cardId(): CardInstanceId {
    return this.context.cardId
  }

  get ownerId(): PlayerId {
    return this.context.ownerId
  }

  private getFormationAbilities(): KeywordAbility[] {
    const { state, boardIndex, card, ownerId } = this.context
    const formationDefinitionId = getFormationDefinitionId(state, ownerId)
    const group = getGroupAt(state, boardIndex)
    const isSingleton = group.startIndex === group.endIndex

    if (!isSingleton) {
      return []
    }

    if (
      formationDefinitionId === RED_FORMATION_ID &&
      card.color === 'red' &&
      countOwnerGroupsContainingColor(state, ownerId, 'red') >= 2
    ) {
      return [{ type: 'loneWarrior', attack: 1, defense: 0 }]
    }

    if (
      formationDefinitionId === BLUE_FORMATION_ID &&
      card.color === 'blue' &&
      countOwnerGroupsContainingColor(state, ownerId, 'blue') >= 2 &&
      !card.abilities.some((ability) => ability.type === 'counter')
    ) {
      return [{ type: 'counter' }]
    }

    return []
  }

  private getAbilities(): KeywordAbility[] {
    return [...this.context.card.abilities, ...this.getFormationAbilities()]
  }

  private getFormationStatModifier(): CreatureStatModifier {
    const { state, boardIndex, card, ownerId } = this.context
    const formationDefinitionId = getFormationDefinitionId(state, ownerId)
    const group = getGroupAt(state, boardIndex)
    const isSingleton = group.startIndex === group.endIndex

    if (!isSingleton) {
      return NO_STAT_MODIFIER
    }

    if (
      formationDefinitionId === BLUE_FORMATION_ID &&
      card.color === 'blue' &&
      countOwnerGroupsContainingColor(state, ownerId, 'blue') >= 2 &&
      card.abilities.some((ability) => ability.type === 'counter')
    ) {
      return { attack: 1, defense: 0 }
    }

    if (
      formationDefinitionId === GREEN_FORMATION_ID &&
      card.color === 'green' &&
      countOwnerGroupsContainingColor(state, ownerId, 'green') >= 2
    ) {
      return { attack: 0, defense: 1 }
    }

    return NO_STAT_MODIFIER
  }

  getPositionStatModifier(): CreatureStatModifier {
    const abilityModifier = this.getAbilities().reduce<CreatureStatModifier>(
      (total, ability) => {
        const modifier =
          getAbilityHandler(ability).getPositionStatModifier?.(ability, this.context) ??
          NO_STAT_MODIFIER
        return {
          attack: total.attack + modifier.attack,
          defense: total.defense + modifier.defense,
        }
      },
      NO_STAT_MODIFIER,
    )
    const formationModifier = this.getFormationStatModifier()
    return {
      attack: abilityModifier.attack + formationModifier.attack,
      defense: abilityModifier.defense + formationModifier.defense,
    }
  }

  getEffectiveStats(): EffectiveCreatureStats {
    const modifier = this.getPositionStatModifier()
    const modifiedAttack = Math.max(0, this.context.card.attack + modifier.attack)
    const attackOverride = this.getAbilities().reduce<number | null>(
      (currentOverride, ability) =>
        currentOverride ??
        getAbilityHandler(ability).getAttackOverride?.(ability, this.context) ??
        null,
      null,
    )
    return {
      attack: attackOverride ?? modifiedAttack,
      defense: Math.max(0, this.context.card.defense + modifier.defense),
      march: this.context.card.march,
    }
  }

  getCounterAttack(): number {
    const group = getGroupAt(this.context.state, this.context.boardIndex)
    const isFront = getFrontIndex(group) === this.context.boardIndex
    const hasCounter = this.getAbilities().some((ability) => ability.type === 'counter')
    return isFront && hasCounter ? this.getEffectiveStats().attack : 0
  }

  getKeepUpManaModifier(): KeepUpManaContribution[] {
    return this.getAbilities().flatMap((ability) => {
      const contribution =
        getAbilityHandler(ability).getKeepUpManaContribution?.(ability, this.context) ?? null
      return contribution === null ? [] : [contribution]
    })
  }

  getSummonCostModifier(summoningPlayerId: PlayerId, insertIndex: number): number {
    return this.getAbilities().reduce(
      (total, ability) =>
        total +
        (getAbilityHandler(ability).getSummonCostModifier?.(
          ability,
          this.context,
          summoningPlayerId,
          insertIndex,
        ) ?? 0),
      0,
    )
  }

  getOpponentMarchCost(movingPlayerId: PlayerId): number {
    return this.getAbilities().reduce(
      (total, ability) =>
        total +
        (getAbilityHandler(ability).getOpponentMarchCost?.(
          ability,
          this.context,
          movingPlayerId,
        ) ?? 0),
      0,
    )
  }

  getActivatedActions(): ActivatedAbilityOption[] {
    const options = this.getAbilities().flatMap((ability) => {
      const option = getAbilityHandler(ability).getActivatedAbility?.(ability, this.context)
      return option ? [option] : []
    })
    return options.filter(
      (option, index) =>
        options.findIndex(({ abilityType }) => abilityType === option.abilityType) === index,
    )
  }

  getActivatedAbilityResolution(
    abilityType: ActivatedAbilityType,
  ): ActivatedAbilityResolution {
    const ability = this.getAbilities().find((candidate) => candidate.type === abilityType)
    const resolution = ability
      ? getAbilityHandler(ability).getActivatedResolution?.(ability, this.context)
      : undefined
    if (!resolution) {
      throw new Error(`Creature card ${this.context.cardId} does not have ${abilityType}.`)
    }
    return resolution
  }

  preventsDestructionRefund(): boolean {
    return this.getAbilities().some(
      (ability) => getAbilityHandler(ability).preventsDestructionRefund === true,
    )
  }
}

export const getGreenFormationKeepUpMana = (
  state: GameState,
  ownerId: PlayerId,
): number =>
  getFormationDefinitionId(state, ownerId) === GREEN_FORMATION_ID &&
  countOwnerGroupsContainingColor(state, ownerId, 'green') >= 3
    ? 1
    : 0
