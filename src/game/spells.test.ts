import { describe, expect, it } from 'vitest'
import { GameManager, assertValidGameState } from './GameManager'
import type { CardInstanceId, GameState, PlayerId } from './types'

const KEEP_ORDER_RANDOM = () => 1 - Number.EPSILON

const findCardIds = (
  state: GameState,
  ownerId: PlayerId,
  predicate: (cardId: CardInstanceId) => boolean,
  count: number,
): CardInstanceId[] => {
  const ids = Object.values(state.cards)
    .filter(({ id, ownerId: candidateOwnerId }) =>
      candidateOwnerId === ownerId && predicate(id),
    )
    .map(({ id }) => id)
    .slice(0, count)
  if (ids.length !== count) {
    throw new Error(`Expected ${count} matching cards for ${ownerId}.`)
  }
  return ids
}

type ConfiguredState = {
  hands?: Partial<Record<PlayerId, CardInstanceId[]>>
  discards?: Partial<Record<PlayerId, CardInstanceId[]>>
  board?: CardInstanceId[]
  mana?: Partial<Record<PlayerId, number>>
}

const configureState = (
  manager: GameManager,
  {
    hands = {},
    discards = {},
    board = [],
    mana = {},
  }: ConfiguredState,
): GameManager => {
  const movedCardIds = new Set([
    ...Object.values(hands).flat(),
    ...Object.values(discards).flat(),
    ...board,
  ])
  const preparePlayer = (playerId: PlayerId) => {
    const player = manager.state.players[playerId]
    const ownedUnmovedCards = Object.values(manager.state.cards)
      .filter(({ id, ownerId }) => ownerId === playerId && !movedCardIds.has(id))
      .map(({ id }) => id)
    return {
      ...player,
      mana: mana[playerId] ?? 0,
      deck: ownedUnmovedCards,
      hand: hands[playerId] ?? [],
      discard: discards[playerId] ?? [],
      exile: [],
      placedSpell: null,
    }
  }

  return GameManager.from({
    ...manager.state,
    turn: 10,
    activePlayerId: 'playerA',
    phase: 'main',
    hasAttackedThisTurn: false,
    hasDiscardedThisTurn: false,
    pendingCombat: null,
    players: {
      playerA: preparePlayer('playerA'),
      playerB: preparePlayer('playerB'),
    },
    board: {
      creatures: board.map((cardId) => ({ cardId, summonedTurn: 9 })),
    },
  })
}

const findDefinition = (
  state: GameState,
  ownerId: PlayerId,
  definitionId: string,
): CardInstanceId =>
  findCardIds(
    state,
    ownerId,
    (cardId) => state.cards[cardId].card.definitionId === definitionId,
    1,
  )[0]

describe('spell rules', () => {
  it('keeps return fire in the spell zone until the caster turn ends', () => {
    const initial = GameManager.create(KEEP_ORDER_RANDOM)
    const returnFire = findDefinition(
      initial.state,
      'playerA',
      'cost0-spell-return-fire',
    )
    let manager = configureState(initial, { hands: { playerA: [returnFire] } })

    expect(GameManager.isCardPlayable(manager, returnFire)).toBe(true)
    manager = GameManager.playSpell(manager, returnFire)

    expect(manager.state.players.playerA.hand).toEqual([])
    expect(manager.state.players.playerA.discard).toEqual([])
    expect(manager.state.players.playerA.placedSpell).toEqual({
      cardId: returnFire,
      effectAmount: 0,
    })
    expect(manager.state.pendingCombat).toBeNull()

    manager = GameManager.passPhase(manager)
    manager = GameManager.passPhase(manager)
    manager = GameManager.passPhase(manager)

    expect(manager.state.activePlayerId).toBe('playerB')
    expect(manager.state.players.playerA.placedSpell).toBeNull()
    expect(manager.state.players.playerA.discard).toEqual([returnFire])
  })

  it('makes return fire exile only the caster discard and damage an adjacent friendly group', () => {
    const initial = GameManager.create(KEEP_ORDER_RANDOM)
    const returnFire = findDefinition(
      initial.state,
      'playerA',
      'cost0-spell-return-fire',
    )
    const redDiscards = findCardIds(
      initial.state,
      'playerA',
      (cardId) => {
        const card = initial.state.cards[cardId].card
        return card.kind === 'creature' && card.color === 'red' && card.cost === 2
      },
      5,
    )
    const [blueDiscard] = findCardIds(
      initial.state,
      'playerA',
      (cardId) => {
        const card = initial.state.cards[cardId].card
        return card.kind === 'creature' && card.color === 'blue'
      },
      1,
    )
    const friendlyGroup = findCardIds(
      initial.state,
      'playerA',
      (cardId) =>
        initial.state.cards[cardId].card.definitionId ===
        'green-cost2-attack2-defense3-march1',
      2,
    )
    let manager = configureState(initial, {
      hands: { playerA: [returnFire] },
      discards: { playerA: [...redDiscards, blueDiscard] },
      board: friendlyGroup,
    })

    manager = GameManager.playSpell(manager, returnFire)

    expect(manager.state.players.playerA.exile).toEqual(redDiscards)
    expect(manager.state.players.playerA.discard).toEqual([blueDiscard])
    expect(manager.state.players.playerA.placedSpell).toEqual({
      cardId: returnFire,
      effectAmount: 5,
    })
    expect(manager.state.pendingCombat).toMatchObject({
      damageMarkers: [
        { cardId: friendlyGroup[0], damage: 5 },
        { cardId: friendlyGroup[1], damage: 2 },
      ],
      destroyedCardIds: [friendlyGroup[0]],
      defendingPlayerId: 'playerA',
      playerWasHit: false,
      playerDamage: 0,
      endsTurnAfterResolution: false,
    })

    manager = GameManager.finishCombat(manager)

    expect(manager.state.turn).toBe(10)
    expect(manager.state.activePlayerId).toBe('playerA')
    expect(manager.state.phase).toBe('main')
    expect(manager.state.board.creatures.map(({ cardId }) => cardId)).toEqual([
      friendlyGroup[1],
    ])
    expect(manager.state.players.playerA.discard).toContain(friendlyGroup[0])
    expect(manager.state.players.playerA.placedSpell?.cardId).toBe(returnFire)
    expect(manager.state.players.playerA.mana).toBe(1)
    expect(() => assertValidGameState(manager.state)).not.toThrow()
  })

  it('keeps bubble wall through the opponent turn and expires it at the next own turn', () => {
    const initial = GameManager.create(KEEP_ORDER_RANDOM)
    const bubbleWall = findDefinition(
      initial.state,
      'playerA',
      'cost0-spell-bubble-wall',
    )
    const blueDiscards = findCardIds(
      initial.state,
      'playerA',
      (cardId) => {
        const card = initial.state.cards[cardId].card
        return card.kind === 'creature' && card.color === 'blue'
      },
      2,
    )
    const attacker = findDefinition(
      initial.state,
      'playerB',
      'red-cost5-attack7-defense4-march2-vanish',
    )
    let manager = configureState(initial, {
      hands: { playerA: [bubbleWall] },
      discards: { playerA: blueDiscards },
      board: [attacker],
    })

    manager = GameManager.playSpell(manager, bubbleWall)
    expect(manager.state.players.playerA.placedSpell).toEqual({
      cardId: bubbleWall,
      effectAmount: 2,
    })
    expect(GameManager.getPlayerBarrier(manager, 'playerA')).toBe(4)
    manager = GameManager.passPhase(manager)
    manager = GameManager.passPhase(manager)
    manager = GameManager.passPhase(manager)

    expect(manager.state.activePlayerId).toBe('playerB')
    expect(GameManager.getPlayerBarrier(manager, 'playerA')).toBe(4)
    manager = GameManager.attackGroup(manager, 0, 0)
    expect(manager.state.pendingCombat?.playerDamage).toBe(3)
    manager = GameManager.finishCombat(manager)

    expect(manager.state.activePlayerId).toBe('playerA')
    expect(manager.state.players.playerA.placedSpell).toBeNull()
    expect(manager.state.players.playerA.discard).toContain(bubbleWall)
    expect(GameManager.getPlayerBarrier(manager, 'playerA')).toBe(2)
  })

  it('gains abundance mana, prevents attacks, and can be overwritten by another duration spell', () => {
    const initial = GameManager.create(KEEP_ORDER_RANDOM)
    const abundance = findDefinition(
      initial.state,
      'playerA',
      'cost0-spell-abundance',
    )
    const bubbleWall = findDefinition(
      initial.state,
      'playerA',
      'cost0-spell-bubble-wall',
    )
    const greenDiscards = findCardIds(
      initial.state,
      'playerA',
      (cardId) => {
        const card = initial.state.cards[cardId].card
        return card.kind === 'creature' && card.color === 'green'
      },
      3,
    )
    const [redDiscard, attacker] = findCardIds(
      initial.state,
      'playerA',
      (cardId) => {
        const card = initial.state.cards[cardId].card
        return card.kind === 'creature' && card.color === 'red'
      },
      2,
    )
    let manager = configureState(initial, {
      hands: { playerA: [abundance, bubbleWall] },
      discards: { playerA: [...greenDiscards, redDiscard] },
      board: [attacker],
    })

    manager = GameManager.playSpell(manager, abundance)

    expect(manager.state.players.playerA.mana).toBe(3)
    expect(manager.state.players.playerA.exile).toEqual(greenDiscards)
    expect(manager.state.players.playerA.discard).toEqual([redDiscard])
    expect(GameManager.canCurrentPlayerAttack(manager)).toBe(false)
    expect(() => GameManager.attackGroup(manager, 0, 0)).toThrow(/cannot attack/)

    manager = GameManager.playSpell(manager, bubbleWall)
    expect(manager.state.players.playerA.placedSpell).toEqual({
      cardId: bubbleWall,
      effectAmount: 0,
    })
    expect(manager.state.players.playerA.discard).toEqual([redDiscard, abundance])
    expect(GameManager.canCurrentPlayerAttack(manager)).toBe(true)

    manager = GameManager.passPhase(manager)
    expect(GameManager.getLegalBattleActions(manager)).toEqual([
      { type: 'attackGroup', startIndex: 0, endIndex: 0 },
    ])
    manager = GameManager.passPhase(manager)
    manager = GameManager.passPhase(manager)

    expect(manager.state.activePlayerId).toBe('playerB')
    expect(manager.state.players.playerA.placedSpell?.cardId).toBe(bubbleWall)
    expect(() => assertValidGameState(manager.state)).not.toThrow()
  })

  it('expires abundance at the end of its caster turn', () => {
    const initial = GameManager.create(KEEP_ORDER_RANDOM)
    const abundance = findDefinition(
      initial.state,
      'playerA',
      'cost0-spell-abundance',
    )
    const [greenDiscard] = findCardIds(
      initial.state,
      'playerA',
      (cardId) => {
        const card = initial.state.cards[cardId].card
        return card.kind === 'creature' && card.color === 'green'
      },
      1,
    )
    let manager = configureState(initial, {
      hands: { playerA: [abundance] },
      discards: { playerA: [greenDiscard] },
    })

    manager = GameManager.playSpell(manager, abundance)
    manager = GameManager.passPhase(manager)
    manager = GameManager.passPhase(manager)
    manager = GameManager.passPhase(manager)

    expect(manager.state.activePlayerId).toBe('playerB')
    expect(manager.state.players.playerA.placedSpell).toBeNull()
    expect(manager.state.players.playerA.discard).toContain(abundance)
    expect(manager.state.players.playerA.exile).toContain(greenDiscard)
  })
})
