import { describe, expect, it } from 'vitest'
import { CreatureRules } from './CreatureRules'
import { GameManager } from './GameManager'
import { getCrossedIndexes } from './boardQueries'
import { CREATURE_CARDS } from './cards'
import type {
  CardInstanceId,
  CreatureCard,
  GameState,
  Phase,
  PlayerId,
} from './types'

const KEEP_ORDER_RANDOM = () => 1 - Number.EPSILON

type BoardSpec = {
  cardId: CardInstanceId
  summonedTurn?: number
}

type ConfigureOptions = {
  board: BoardSpec[]
  activePlayerId?: PlayerId
  phase?: Phase
  mana?: Partial<Record<PlayerId, number>>
  formations?: Partial<Record<PlayerId, CardInstanceId>>
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
    formations = {},
    handAdditions = [],
    turn = 10,
  }: ConfigureOptions,
): GameManager => {
  const movedCardIds = new Set([
    ...board.map(({ cardId }) => cardId),
    ...Object.values(formations),
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
      formation: formations[playerId] ?? null,
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
  it('counts every crossed card on either side of a creature anchor', () => {
    expect(getCrossedIndexes(4, 'playerA', 2, 0)).toEqual([0, 1])
    expect(getCrossedIndexes(4, 'playerA', 1, 4)).toEqual([2, 3])
    expect(getCrossedIndexes(4, 'playerB', null, 1)).toEqual([1, 2, 3])
  })
})

describe('CreatureRules position modifiers', () => {
  it('applies position abilities without giving every creature summon sickness', () => {
    const initial = createTestManager()
    const [loneWarrior] = findCardIds(
      initial.state,
      'playerA',
      'red-cost2-attack2-defense2-march1-lone-warrior-2-0',
    )
    const [enemyLeft, enemyRight] = findCardIds(
      initial.state,
      'playerB',
      'red-cost2-attack3-defense2-march1',
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
      defense: 2,
      march: 1,
    })

    const [assassin] = findCardIds(
      initial.state,
      'playerA',
      'red-cost2-attack2-defense2-march1-assassin2',
    )
    manager = configureManager(initial, { board: [{ cardId: assassin }] })
    expect(GameManager.getCreatureStats(manager, assassin).attack).toBe(4)

    const [rearguardA] = findCardIds(
      initial.state,
      'playerA',
      'green-cost2-attack2-defense2-march1-rearguard-0-2',
    )
    manager = configureManager(initial, {
      board: [{ cardId: enemyLeft }, { cardId: rearguardA }],
    })
    expect(GameManager.getCreatureStats(manager, rearguardA).defense).toBe(4)

    const [rearguardB] = findCardIds(
      initial.state,
      'playerB',
      'green-cost2-attack2-defense2-march1-rearguard-0-2',
    )
    const [allyA] = findCardIds(
      initial.state,
      'playerA',
      'green-cost2-attack2-defense3-march1',
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
      'red-cost2-attack2-defense2-march1-lone-warrior-2-0',
    )
    const [enemyLeft, enemyRight] = findCardIds(
      initial.state,
      'playerB',
      'red-cost2-attack3-defense2-march1',
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
      defense: 3,
      march: 1,
    })
    expect(JSON.parse(JSON.stringify(manager.state.cards[source]))).toEqual(
      manager.state.cards[source],
    )
  })
})

describe('summon modifiers', () => {
  it('adds capture to crossed march distance for both player directions', () => {
    const initial = createTestManager()
    const [captureB] = findCardIds(
      initial.state,
      'playerB',
      'green-cost2-attack1-defense3-march1-capture1',
    )
    const [summonA] = findCardIds(
      initial.state,
      'playerA',
      'red-cost2-attack3-defense2-march1',
    )
    let manager = configureManager(initial, {
      board: [{ cardId: captureB }],
      mana: { playerA: 2 },
    })
    expect(GameManager.getSummonOptions(manager, summonA)[1]).toMatchObject({
      requiredMarch: 2,
      canReach: false,
    })

    const [captureA] = findCardIds(
      initial.state,
      'playerA',
      'green-cost2-attack1-defense3-march1-capture1',
    )
    const [summonB] = findCardIds(
      initial.state,
      'playerB',
      'red-cost2-attack3-defense2-march1',
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
      'red-cost2-attack3-defense2-march1',
    )
    const [beachhead] = findCardIds(
      initial.state,
      'playerA',
      'blue-cost2-attack2-defense2-march1-beachhead1',
    )
    const [summonCard] = findCardIds(
      initial.state,
      'playerA',
      'red-cost2-attack3-defense2-march1',
    )
    let manager = configureManager(initial, {
      board: [{ cardId: enemy }, { cardId: beachhead }],
      mana: { playerA: 1 },
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
      'red-cost2-attack3-defense2-march1',
      2,
    )
    const [minerA, minerB] = findCardIds(
      initial.state,
      'playerA',
      'green-cost2-attack2-defense2-march1-mining1',
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

  it('adds green formation mana at three green groups', () => {
    const initial = createTestManager()
    const greenCreatures = findCardIds(
      initial.state,
      'playerA',
      'green-cost2-attack2-defense3-march1',
      3,
    )
    const enemies = findCardIds(
      initial.state,
      'playerB',
      'red-cost2-attack3-defense2-march1',
      2,
    )
    const [formation] = findCardIds(
      initial.state,
      'playerA',
      'green-cost4-formation',
    )
    let manager = configureManager(initial, {
      board: [
        { cardId: greenCreatures[0] },
        { cardId: enemies[0] },
        { cardId: greenCreatures[1] },
        { cardId: enemies[1] },
        { cardId: greenCreatures[2] },
      ],
      phase: 'keepUp',
      mana: { playerA: 0 },
      formations: { playerA: formation },
    })

    manager = GameManager.resolveKeepUp(manager)
    expect(manager.state.players.playerA.mana).toBe(3)
  })
})

describe('formation creature effects', () => {
  it('applies red, blue, and green singleton effects at two color groups', () => {
    const initial = createTestManager()
    const enemies = findCardIds(
      initial.state,
      'playerB',
      'red-cost2-attack3-defense2-march1',
      2,
    )

    const redCreatures = findCardIds(
      initial.state,
      'playerA',
      'red-cost2-attack3-defense2-march1',
      2,
    )
    const [redFormation] = findCardIds(
      initial.state,
      'playerA',
      'red-cost4-formation',
    )
    let manager = configureManager(initial, {
      board: [
        { cardId: enemies[0] },
        { cardId: redCreatures[0] },
        { cardId: enemies[1] },
        { cardId: redCreatures[1] },
      ],
      formations: { playerA: redFormation },
    })
    expect(GameManager.getCreatureStats(manager, redCreatures[0])).toMatchObject({
      attack: 4,
      defense: 3,
    })

    const [blueCounter] = findCardIds(
      initial.state,
      'playerA',
      'blue-cost2-attack3-defense1-march1-counter',
    )
    const [blueVanilla] = findCardIds(
      initial.state,
      'playerA',
      'blue-cost2-attack2-defense2-march2',
    )
    const [blueFormation] = findCardIds(
      initial.state,
      'playerA',
      'blue-cost4-formation',
    )
    manager = configureManager(initial, {
      board: [
        { cardId: enemies[0] },
        { cardId: blueCounter },
        { cardId: enemies[1] },
        { cardId: blueVanilla },
      ],
      formations: { playerA: blueFormation },
    })
    expect(GameManager.getCreatureStats(manager, blueCounter).attack).toBe(4)
    expect(CreatureRules.fromCardId(manager.state, blueVanilla).getCounterAttack()).toBe(2)

    const greenCreatures = findCardIds(
      initial.state,
      'playerA',
      'green-cost2-attack2-defense3-march1',
      2,
    )
    const [greenFormation] = findCardIds(
      initial.state,
      'playerA',
      'green-cost4-formation',
    )
    manager = configureManager(initial, {
      board: [
        { cardId: greenCreatures[0] },
        { cardId: enemies[0] },
        { cardId: greenCreatures[1] },
      ],
      formations: { playerA: greenFormation },
    })
    expect(GameManager.getCreatureStats(manager, greenCreatures[0]).defense).toBe(4)
  })
})

describe('combat abilities', () => {
  it('resolves counterattack simultaneously against the attacking front creature', () => {
    const initial = createTestManager()
    const [attackingRear, attackingFront] = findCardIds(
      initial.state,
      'playerA',
      'red-cost2-attack3-defense2-march1',
      2,
    )
    const [counter] = findCardIds(
      initial.state,
      'playerB',
      'blue-cost2-attack3-defense1-march1-counter',
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
      'red-cost5-attack7-defense6-march3-vanish',
    )
    const [vanishingDefender] = findCardIds(
      initial.state,
      'playerB',
      'blue-cost5-attack4-defense6-march4-vanish',
    )
    let manager = configureManager(initial, {
      board: [{ cardId: attacker }, { cardId: vanishingDefender }],
      mana: { playerA: 0, playerB: 0 },
    })

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
      'red-cost2-attack3-defense1-march1-withdraw',
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
      'blue-cost2-attack1-defense1-march2-return',
    )
    let manager = configureManager(initial, { board: [{ cardId: source }] })
    manager = GameManager.activateAbility(manager, source, 'return')
    expect(manager.state.players.playerA.hand).toHaveLength(5)
    expect(manager.state.players.playerA.hand).toContain(source)

    const [fullHandSource] = findCardIds(
      initial.state,
      'playerA',
      'blue-cost4-attack4-defense2-march2-return',
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
})
