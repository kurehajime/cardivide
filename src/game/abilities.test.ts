import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import {
  getCrossedIndexes,
  isAdjacentInsertToAnchor,
  isForwardInsertFromAnchor,
} from './boardQueries'
import { CARD_DEFINITION_IDS, CREATURE_CARDS } from './cards'
import type {
  CardInstanceId,
  CreatureCard,
  GameState,
  Phase,
  PlayerId,
} from './types'

const KEEP_ORDER_RANDOM = () => 1 - Number.EPSILON
const CARD_ID = CARD_DEFINITION_IDS

type BoardSpec = {
  cardId: CardInstanceId
  summonedTurn?: number
}

type ConfigureOptions = {
  board: BoardSpec[]
  activePlayerId?: PlayerId
  phase?: Phase
  mana?: Partial<Record<PlayerId, number>>
  handAdditions?: CardInstanceId[]
  turn?: number
}

const createTestManager = (): GameManager => GameManager.create(KEEP_ORDER_RANDOM)

const findCardIds = (
  state: GameState,
  ownerId: PlayerId,
  definitionId: string,
  count = 1,
): CardInstanceId[] => {
  const ids = Object.values(state.cards)
    .filter(
      (instance) =>
        instance.ownerId === ownerId && instance.card.definitionId === definitionId,
    )
    .map(({ id }) => id)
    .slice(0, count)
  if (ids.length !== count) {
    throw new Error(`Expected ${count} copies of ${definitionId} for ${ownerId}.`)
  }
  return ids
}

const configureManager = (
  manager: GameManager,
  {
    board,
    activePlayerId = 'playerA',
    phase = 'main',
    mana = {},
    handAdditions = [],
    turn = 10,
  }: ConfigureOptions,
): GameManager => {
  const movedCardIds = new Set([
    ...board.map(({ cardId }) => cardId),
    ...handAdditions,
  ])
  const preparePlayer = (playerId: PlayerId) => {
    const player = manager.state.players[playerId]
    const addedHandCards = handAdditions.filter(
      (cardId) => manager.state.cards[cardId].ownerId === playerId,
    )
    return {
      ...player,
      mana: mana[playerId] ?? player.mana,
      deck: player.deck.filter((cardId) => !movedCardIds.has(cardId)),
      hand: [
        ...player.hand.filter((cardId) => !movedCardIds.has(cardId)),
        ...addedHandCards,
      ],
      discard: player.discard.filter((cardId) => !movedCardIds.has(cardId)),
    }
  }

  return GameManager.from({
    ...manager.state,
    turn,
    activePlayerId,
    phase,
    hasAttackedThisTurn: false,
    pendingCombat: null,
    players: {
      playerA: preparePlayer('playerA'),
      playerB: preparePlayer('playerB'),
    },
    board: {
      creatures: board.map(({ cardId, summonedTurn = turn - 1 }) => ({
        cardId,
        summonedTurn,
      })),
    },
  })
}

describe('board march distance', () => {
  it('counts crossed cards and only uses creature anchors toward the opponent', () => {
    expect(getCrossedIndexes(4, 'playerA', 2, 0)).toEqual([0, 1])
    expect(getCrossedIndexes(4, 'playerA', 1, 4)).toEqual([2, 3])
    expect(getCrossedIndexes(4, 'playerB', null, 1)).toEqual([1, 2, 3])
    expect(isForwardInsertFromAnchor('playerA', 2, 2)).toBe(false)
    expect(isForwardInsertFromAnchor('playerA', 2, 3)).toBe(true)
    expect(isForwardInsertFromAnchor('playerB', 2, 2)).toBe(true)
    expect(isForwardInsertFromAnchor('playerB', 2, 3)).toBe(false)
    expect(isAdjacentInsertToAnchor(2, 2)).toBe(true)
    expect(isAdjacentInsertToAnchor(2, 3)).toBe(true)
    expect(isAdjacentInsertToAnchor(2, 1)).toBe(false)
  })
})

describe('CreatureRules position modifiers', () => {
  it('applies position abilities without giving every creature summon sickness', () => {
    const initial = createTestManager()
    const [loneWarrior] = findCardIds(
      initial.state,
      'playerA',
      CARD_ID.SOLITARY_PEAK_SWORDSMAN,
    )
    const [enemyLeft, enemyRight] = findCardIds(
      initial.state,
      'playerB',
      CARD_ID.SPARK_SWORDSMAN,
      2,
    )
    let manager = configureManager(initial, {
      board: [
        { cardId: enemyLeft },
        { cardId: loneWarrior },
        { cardId: enemyRight },
      ],
    })
    expect(GameManager.getCreatureStats(manager, loneWarrior)).toEqual({
      attack: 4,
      defense: 1,
      march: 1,
    })
    expect(GameManager.getCreatureStatModifier(manager, loneWarrior)).toEqual({
      attack: 2,
      defense: 0,
    })

    const [assassin] = findCardIds(
      initial.state,
      'playerA',
      CARD_ID.CRIMSON_BLADE_INFILTRATOR,
    )
    manager = configureManager(initial, { board: [{ cardId: assassin }] })
    expect(GameManager.getCreatureStats(manager, assassin).attack).toBe(4)

    const [rearguardA] = findCardIds(
      initial.state,
      'playerA',
      CARD_ID.ROOT_FORT_REARGUARD,
    )
    manager = configureManager(initial, {
      board: [{ cardId: enemyLeft }, { cardId: rearguardA }],
    })
    expect(GameManager.getCreatureStats(manager, rearguardA).defense).toBe(4)

    const [rearguardB] = findCardIds(
      initial.state,
      'playerB',
      CARD_ID.ROOT_FORT_REARGUARD,
    )
    const [allyA] = findCardIds(
      initial.state,
      'playerA',
      CARD_ID.OAKBARK_SENTINEL,
    )
    manager = configureManager(initial, {
      board: [{ cardId: rearguardB }, { cardId: allyA }],
    })
    expect(GameManager.getCreatureStats(manager, rearguardB).defense).toBe(4)

    manager = configureManager(initial, {
      board: [{ cardId: allyA, summonedTurn: 10 }],
      turn: 10,
    })
    expect(GameManager.getCreatureStats(manager, allyA).attack).toBe(2)
    const currentCreatureCards: readonly CreatureCard[] = CREATURE_CARDS
    expect(
      currentCreatureCards.every((card) =>
        card.abilities.every((ability) => ability.type !== 'summoningSickness'),
      ),
    ).toBe(true)

    const allyInstance = manager.state.cards[allyA]
    if (allyInstance.card.kind !== 'creature') {
      throw new Error('Expected a creature card.')
    }
    manager = GameManager.from({
      ...manager.state,
      cards: {
        ...manager.state.cards,
        [allyA]: {
          ...allyInstance,
          card: {
            ...allyInstance.card,
            abilities: [
              ...allyInstance.card.abilities,
              { type: 'summoningSickness' },
            ],
          },
        },
      },
    })
    expect(GameManager.getCreatureStats(manager, allyA).attack).toBe(0)
  })

  it('adds repeated numeric abilities while keeping the card instance serializable', () => {
    const initial = createTestManager()
    const [source] = findCardIds(
      initial.state,
      'playerA',
      CARD_ID.SOLITARY_PEAK_SWORDSMAN,
    )
    const [enemyLeft, enemyRight] = findCardIds(
      initial.state,
      'playerB',
      CARD_ID.SPARK_SWORDSMAN,
      2,
    )
    let manager = configureManager(initial, {
      board: [{ cardId: enemyLeft }, { cardId: source }, { cardId: enemyRight }],
    })
    const instance = manager.state.cards[source]
    if (instance.card.kind !== 'creature') {
      throw new Error('Expected a creature card.')
    }
    manager = GameManager.from({
      ...manager.state,
      cards: {
        ...manager.state.cards,
        [source]: {
          ...instance,
          card: {
            ...instance.card,
            abilities: [
              { type: 'loneWarrior', attack: 1, defense: 0 },
              { type: 'loneWarrior', attack: 2, defense: 1 },
            ],
          },
        },
      },
    })

    expect(GameManager.getCreatureStats(manager, source)).toEqual({
      attack: 5,
      defense: 2,
      march: 1,
    })
    expect(JSON.parse(JSON.stringify(manager.state.cards[source]))).toEqual(
      manager.state.cards[source],
    )
  })
})

describe('summon modifiers', () => {
  it('keeps march zero creatures at the starting edge when they have no ally anchor', () => {
    const initial = createTestManager()
    const [enemy] = findCardIds(
      initial.state,
      'playerB',
      CARD_ID.SPARK_SWORDSMAN,
    )
    const [rootedCreature] = findCardIds(
      initial.state,
      'playerA',
      CARD_ID.ROOTED_ANCIENT,
    )
    const manager = configureManager(initial, {
      board: [{ cardId: enemy }],
      mana: { playerA: 2 },
      handAdditions: [rootedCreature],
    })

    expect(GameManager.getSummonOptions(manager, rootedCreature)[0]).toMatchObject({
      requiredMarch: 0,
      canReach: true,
    })
    expect(GameManager.getSummonOptions(manager, rootedCreature)[1]).toMatchObject({
      requiredMarch: 1,
      canReach: false,
    })
  })

  it('does not use an advanced creature as an anchor for a backward interruption', () => {
    const initial = createTestManager()
    const enemies = findCardIds(
      initial.state,
      'playerB',
      CARD_ID.SPARK_SWORDSMAN,
      3,
    )
    const [advancedAlly] = findCardIds(
      initial.state,
      'playerA',
      CARD_ID.OAKBARK_SENTINEL,
    )
    const [summonCard] = findCardIds(
      initial.state,
      'playerA',
      CARD_ID.SPARK_SWORDSMAN,
    )
    let manager = configureManager(initial, {
      board: [
        { cardId: enemies[0] },
        { cardId: enemies[1] },
        { cardId: enemies[2] },
        { cardId: advancedAlly },
      ],
      mana: { playerA: 2 },
    })

    expect(GameManager.getSummonOptions(manager, summonCard)[2]).toMatchObject({
      requiredMarch: 2,
      canReach: false,
    })
    expect(GameManager.getSummonOptions(manager, summonCard)[3]).toMatchObject({
      requiredMarch: 0,
      canReach: true,
    })
    expect(GameManager.getSummonOptions(manager, summonCard)[4]).toMatchObject({
      requiredMarch: 0,
      canReach: true,
    })
    expect(() => GameManager.summonCreature(manager, summonCard, 2)).toThrow(
      /cannot be summoned at this position/,
    )

    const mirroredEnemies = findCardIds(
      initial.state,
      'playerA',
      CARD_ID.SPARK_SWORDSMAN,
      3,
    )
    const [advancedAllyB] = findCardIds(
      initial.state,
      'playerB',
      CARD_ID.OAKBARK_SENTINEL,
    )
    const [summonCardB] = findCardIds(
      initial.state,
      'playerB',
      CARD_ID.SPARK_SWORDSMAN,
    )
    manager = configureManager(initial, {
      board: [
        { cardId: advancedAllyB },
        { cardId: mirroredEnemies[0] },
        { cardId: mirroredEnemies[1] },
        { cardId: mirroredEnemies[2] },
      ],
      activePlayerId: 'playerB',
      mana: { playerB: 2 },
      handAdditions: [summonCardB],
    })

    expect(GameManager.getSummonOptions(manager, summonCardB)[2]).toMatchObject({
      requiredMarch: 2,
      canReach: false,
    })
    expect(GameManager.getSummonOptions(manager, summonCardB)[1]).toMatchObject({
      requiredMarch: 0,
      canReach: true,
    })
    expect(GameManager.getSummonOptions(manager, summonCardB)[0]).toMatchObject({
      requiredMarch: 0,
      canReach: true,
    })
  })

  it('adds each capture value to crossed march distance for both player directions', () => {
    const initial = createTestManager()
    const [captureB] = findCardIds(
      initial.state,
      'playerB',
      CARD_ID.FOREST_CAGE_BEASTMASTER,
    )
    const [summonA] = findCardIds(
      initial.state,
      'playerA',
      CARD_ID.SPARK_SWORDSMAN,
    )
    let manager = configureManager(initial, {
      board: [{ cardId: captureB }],
      mana: { playerA: 2 },
    })
    expect(GameManager.getSummonOptions(manager, summonA)[1]).toMatchObject({
      requiredMarch: 3,
      canReach: false,
    })

    const [captureA] = findCardIds(
      initial.state,
      'playerA',
      CARD_ID.VINE_SNARE_HUNTER,
    )
    const [summonB] = findCardIds(
      initial.state,
      'playerB',
      CARD_ID.SPARK_SWORDSMAN,
    )
    manager = configureManager(initial, {
      board: [{ cardId: captureA }],
      activePlayerId: 'playerB',
      mana: { playerB: 2 },
      handAdditions: [summonB],
    })
    expect(GameManager.getSummonOptions(manager, summonB)[0]).toMatchObject({
      requiredMarch: 2,
      canReach: false,
    })
  })

  it('uses bridgehead discounted cost for playability and mana payment', () => {
    const initial = createTestManager()
    const [enemy] = findCardIds(
      initial.state,
      'playerB',
      CARD_ID.SPARK_SWORDSMAN,
    )
    const [beachhead] = findCardIds(
      initial.state,
      'playerA',
      CARD_ID.TIDEFRONT_FORTIFIER,
    )
    const [summonCard] = findCardIds(
      initial.state,
      'playerA',
      CARD_ID.SPARK_SWORDSMAN,
    )
    let manager = configureManager(initial, {
      board: [{ cardId: enemy }, { cardId: beachhead }],
      mana: { playerA: 1 },
    })
    expect(manager.state.cards[beachhead].card).toMatchObject({
      name: '偵察者',
      attack: 2,
      defense: 2,
      march: 2,
    })

    expect(GameManager.getSummonOptions(manager, summonCard)[2]).toMatchObject({
      effectiveCost: 1,
      canReach: true,
      affordable: true,
      canSummon: true,
    })
    expect(GameManager.isCardPlayable(manager, summonCard)).toBe(true)

    manager = GameManager.summonCreature(manager, summonCard, 2)
    expect(manager.state.players.playerA.mana).toBe(0)
    expect(manager.state.players.playerA.hand).not.toContain(summonCard)
    expect(manager.state.board.creatures.at(-1)?.cardId).toBe(summonCard)
  })
})

describe('keep-up mana abilities', () => {
  it('uses only the highest mining value in one surrounded group', () => {
    const initial = createTestManager()
    const [enemyLeft, enemyRight] = findCardIds(
      initial.state,
      'playerB',
      CARD_ID.SPARK_SWORDSMAN,
      2,
    )
    const [minerA, minerB] = findCardIds(
      initial.state,
      'playerA',
      CARD_ID.GEODE_MINER,
      2,
    )
    let manager = configureManager(initial, {
      board: [
        { cardId: enemyLeft },
        { cardId: minerA },
        { cardId: minerB },
        { cardId: enemyRight },
      ],
      phase: 'keepUp',
      mana: { playerA: 0 },
    })

    manager = GameManager.resolveKeepUp(manager)
    expect(manager.state.players.playerA.mana).toBe(3)
  })

})

describe('combat abilities', () => {
  it('resolves counterattack simultaneously against the attacking front creature', () => {
    const initial = createTestManager()
    const [attackingRear, attackingFront] = findCardIds(
      initial.state,
      'playerA',
      CARD_ID.SPARK_SWORDSMAN,
      2,
    )
    const [counter] = findCardIds(
      initial.state,
      'playerB',
      CARD_ID.SURGING_DUELIST,
    )
    let manager = configureManager(initial, {
      board: [
        { cardId: attackingRear },
        { cardId: attackingFront },
        { cardId: counter },
      ],
      mana: { playerA: 0, playerB: 0 },
    })

    manager = GameManager.attackGroup(manager, 0, 1)
    expect(manager.state.pendingCombat?.damageMarkers).toEqual([
      { cardId: counter, damage: 6 },
      { cardId: attackingFront, damage: 3 },
    ])
    expect(new Set(manager.state.pendingCombat?.destroyedCardIds)).toEqual(
      new Set([attackingFront, counter]),
    )
    expect(GameManager.getDestructionManaRefund(manager, attackingFront)).toBe(
      Math.floor(manager.state.cards[attackingFront].card.cost / 2),
    )
    expect(GameManager.getDestructionManaRefund(manager, counter)).toBe(
      Math.floor(manager.state.cards[counter].card.cost / 2),
    )

    manager = GameManager.finishCombat(manager)
    expect(manager.state.players.playerA.discard).toContain(attackingFront)
    expect(manager.state.players.playerA.discard).not.toContain(attackingRear)
    expect(manager.state.players.playerB.discard).toContain(counter)
    expect(manager.state.players.playerA.mana).toBe(1)
    expect(manager.state.players.playerB.mana).toBe(3)
  })

  it('does not refund mana for a creature with vanish', () => {
    const initial = createTestManager()
    const [attacker] = findCardIds(
      initial.state,
      'playerA',
      CARD_ID.EXHAUSTED_VOLCANO_DRAGON,
    )
    const [vanishingDefender] = findCardIds(
      initial.state,
      'playerB',
      CARD_ID.EPHEMERAL_DEEP_WHALE,
    )
    let manager = configureManager(initial, {
      board: [{ cardId: attacker }, { cardId: vanishingDefender }],
      mana: { playerA: 0, playerB: 0 },
    })

    expect(GameManager.getDestructionManaRefund(manager, vanishingDefender)).toBe(0)
    manager = GameManager.attackGroup(manager, 0, 0)
    manager = GameManager.finishCombat(manager)
    expect(manager.state.players.playerB.discard).toContain(vanishingDefender)
    expect(manager.state.players.playerB.mana).toBe(2)
  })
})

describe('activated abilities', () => {
  it('withdraws to discard and refunds full printed cost', () => {
    const initial = createTestManager()
    const [source] = findCardIds(
      initial.state,
      'playerA',
      CARD_ID.FORMATION_CLEARING_MERCENARY,
    )
    let manager = configureManager(initial, {
      board: [{ cardId: source }],
      mana: { playerA: 0 },
    })
    expect(GameManager.getActivatedAbilities(manager)).toContainEqual(
      expect.objectContaining({
        sourceCardId: source,
        abilityType: 'withdraw',
        enabled: true,
      }),
    )

    manager = GameManager.applyAction(manager, {
      type: 'activateAbility',
      sourceCardId: source,
      abilityType: 'withdraw',
    })
    expect(manager.state.board.creatures).toHaveLength(0)
    expect(manager.state.players.playerA.discard).toContain(source)
    expect(manager.state.players.playerA.mana).toBe(2)
  })

  it('returns to a four-card hand and rejects a full hand', () => {
    const initial = createTestManager()
    const [source] = findCardIds(
      initial.state,
      'playerA',
      CARD_ID.MIST_RETURNING_MESSENGER,
    )
    let manager = configureManager(initial, {
      board: [{ cardId: source }],
      mana: { playerA: 0 },
    })
    manager = GameManager.activateAbility(manager, source, 'return')
    expect(manager.state.players.playerA.hand).toHaveLength(5)
    expect(manager.state.players.playerA.hand).toContain(source)
    expect(manager.state.players.playerA.mana).toBe(1)
    expect(manager.state.cards[source].card).toMatchObject({
      name: '傭兵',
      attack: 2,
    })

    const [fullHandSource] = findCardIds(
      initial.state,
      'playerA',
      CARD_ID.WAVE_RETURN_MAGE,
    )
    const extraHandCard = initial.state.players.playerA.deck[0]
    manager = configureManager(initial, {
      board: [{ cardId: fullHandSource }],
      handAdditions: [extraHandCard],
    })
    expect(
      GameManager.getActivatedAbilities(manager).find(
        ({ sourceCardId }) => sourceCardId === fullHandSource,
      ),
    ).toMatchObject({ enabled: false })
    expect(() => GameManager.activateAbility(manager, fullHandSource, 'return')).toThrow(
      /手札が5枚/,
    )
  })

  it('allows a human player to return the same physical card repeatedly in one turn', () => {
    const initial = createTestManager()
    const [source] = findCardIds(
      initial.state,
      'playerA',
      CARD_ID.MIST_RETURNING_MESSENGER,
    )
    let manager = configureManager(initial, {
      board: [{ cardId: source }],
      mana: { playerA: 3 },
    })

    manager = GameManager.activateAbility(manager, source, 'return')
    expect(manager.state.players.playerA.mana).toBe(4)

    const summonOption = GameManager.getSummonOptions(manager, source).find(
      ({ canSummon }) => canSummon,
    )
    expect(summonOption).toBeDefined()
    manager = GameManager.summonCreature(manager, source, summonOption!.insertIndex)
    manager = GameManager.activateAbility(manager, source, 'return')

    expect(manager.state.players.playerA.hand).toContain(source)
    expect(manager.state.players.playerA.mana).toBe(3)
  })
})
