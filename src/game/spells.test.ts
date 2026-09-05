import { describe, expect, it } from 'vitest'
import { CARD_DEFINITION_IDS } from './cards'
import { STANDARD_DECK_LIST } from './decks'
import { GameManager, assertValidGameState } from './GameManager'
import { GameAI } from './ai/GameAI'
import { THEME_DECK_BY_ID, THEME_DECK_IDS } from './themeDecks'
import type { CardInstanceId, GameState, PlayerId } from './types'

const KEEP_ORDER_RANDOM = () => 1 - Number.EPSILON
const CARD_ID = CARD_DEFINITION_IDS

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
  hp?: Partial<Record<PlayerId, number>>
  mana?: Partial<Record<PlayerId, number>>
}

const configureState = (
  manager: GameManager,
  {
    hands = {},
    discards = {},
    board = [],
    hp = {},
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
      hp: hp[playerId] ?? player.hp,
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

const createThemeManager = (
  playerDeckId: keyof typeof THEME_DECK_BY_ID,
): GameManager =>
  GameManager.create(KEEP_ORDER_RANDOM, {
    playerA: THEME_DECK_BY_ID[playerDeckId].cardDefinitionIds,
    playerB: THEME_DECK_BY_ID[THEME_DECK_IDS.RED_BLUE_SKIRMISH].cardDefinitionIds,
  })

const createSelfDestructManager = (): GameManager =>
  GameManager.create(KEEP_ORDER_RANDOM, {
    playerA: [CARD_ID.SELF_DESTRUCT_ORDER, ...STANDARD_DECK_LIST.slice(1)],
    playerB: STANDARD_DECK_LIST,
  })

const createBriberyScenario = (casterId: PlayerId = 'playerA') => {
  const enemyId: PlayerId = casterId === 'playerA' ? 'playerB' : 'playerA'
  const initial = GameManager.create(KEEP_ORDER_RANDOM, {
    playerA: [...STANDARD_DECK_LIST, CARD_ID.BRIBERY],
    playerB: [...STANDARD_DECK_LIST, CARD_ID.BRIBERY],
  })
  const spell = findDefinition(initial.state, casterId, CARD_ID.BRIBERY)
  const target = findDefinition(initial.state, enemyId, CARD_ID.MIST_RETURNING_MESSENGER)
  const dragon = findDefinition(initial.state, enemyId, CARD_ID.EXHAUSTED_VOLCANO_DRAGON)
  const scouts = findCardIds(initial.state, casterId,
    (id) => initial.state.cards[id].card.definitionId === CARD_ID.TIDEWAY_SCOUT, 2)
  const configured = configureState(initial, {
    hands: { [casterId]: [spell] },
    mana: { [casterId]: 3 },
    board: [scouts[0], target, scouts[1], dragon],
  })
  return {
    manager: GameManager.from({ ...configured.state, activePlayerId: casterId }),
    spell, target, dragon, scouts, enemyId,
  }
}

describe('bribery', () => {
  it.each(['playerA', 'playerB'] as const)('changes control for %s without moving or replacing the card', (casterId) => {
    const { manager, spell, target, scouts, enemyId } = createBriberyScenario(casterId)
    const original = manager.state.cards[target]
    const action = { type: 'playSpell', cardId: spell, target: { kind: 'creature', cardId: target } } as const
    expect(GameManager.getSpellPlayActions(manager, spell)).toEqual([action])
    expect(GameManager.getBoardGroups(manager)).toHaveLength(4)
    const bought = GameManager.applyAction(manager, action)
    expect(bought.state.cards[target]).toEqual({ ...original, ownerId: casterId })
    expect(manager.state.cards[target].ownerId).toBe(enemyId)
    expect(manager.state.players[casterId].mana).toBe(3)
    expect(bought.state.board).toEqual(manager.state.board)
    expect(bought.state.players[casterId].mana).toBe(0)
    expect(bought.state.players[enemyId].mana).toBe(0)
    expect(bought.state.players[casterId].placedSpell?.cardId).toBe(spell)
    expect(GameManager.getBoardGroups(bought)).toHaveLength(2)
    expect(GameManager.getBoardGroups(bought)[0]).toMatchObject({ownerId: casterId, startIndex:0, endIndex:2})
    expect(bought.state.cards[scouts[0]]).toEqual(manager.state.cards[scouts[0]])
    expect(() => assertValidGameState(bought.state)).not.toThrow()
  })

  it('rejects friendly, absent and unaffordable targets without spending mana or the spell', () => {
    const { manager, spell, target, dragon, scouts } = createBriberyScenario()
    for (const cardId of [scouts[0], dragon, manager.state.players.playerB.deck[0]]) {
      expect(() => GameManager.playSpell(manager, spell, {kind:'creature',cardId})).toThrow()
    }
    const poor = GameManager.from({ ...manager.state, players: {
      ...manager.state.players,
      playerA: { ...manager.state.players.playerA, mana: 2 },
    } })
    expect(GameManager.getSpellPlayActions(poor, spell)).toEqual([])
    expect(() => GameManager.playSpell(poor, spell, {kind:'creature',cardId:target})).toThrow()
    expect(poor.state.players.playerA.hand).toEqual([spell])
    expect(poor.state.players.playerA.mana).toBe(2)
    expect(poor.state.cards[target].ownerId).toBe('playerB')
  })

  it('returns the bought creature and its mana to the new controller', () => {
    const { manager, spell, target } = createBriberyScenario()
    const bought = GameManager.playSpell(manager, spell, {kind:'creature',cardId:target})
    const returned = GameManager.activateAbility(bought, target, 'return')
    expect(returned.state.players.playerA.hand).toEqual([target])
    expect(returned.state.players.playerA.mana).toBe(1)
    expect(returned.state.players.playerB.hand).not.toContain(target)
    expect(returned.state.cards[target].id).toBe(target)
    expect(() => assertValidGameState(returned.state)).not.toThrow()
  })

  it('sends a destroyed bought creature and the refund to the new controller', () => {
    const { manager, spell, target } = createBriberyScenario()
    const bought = GameManager.playSpell(manager, spell, {kind:'creature',cardId:target})
    const enemyTurn = GameManager.from({...bought.state, activePlayerId:'playerB'})
    const destroyed = GameManager.finishCombat(GameManager.attackGroup(enemyTurn, 3, 3))
    expect(destroyed.state.players.playerA.discard).toContain(target)
    expect(destroyed.state.players.playerB.discard).not.toContain(target)
    // Three cost-2 creatures refund one each, then the new turn adds two mana.
    expect(destroyed.state.players.playerA.mana).toBe(5)
    expect(destroyed.state.players.playerB.mana).toBe(0)
    expect(() => assertValidGameState(destroyed.state)).not.toThrow()
  })

  it('lets the AI buy a creature and attack for a win while keeping other evaluations unchanged', () => {
    const { manager, spell, dragon } = createBriberyScenario()
    const lethal = configureState(manager, {
      hands: {playerA:[spell]}, board:[dragon], mana:{playerA:6}, hp:{playerB:1},
    })
    const action = new GameAI().chooseAction(lethal)
    expect(action).toEqual({type:'playSpell',cardId:spell,target:{kind:'creature',cardId:dragon}})
    expect(lethal.state.cards[dragon].ownerId).toBe('playerB')
    const bought = GameManager.applyAction(lethal, action!)
    expect(bought.state.players.playerA.mana).toBe(0)
    const won = GameManager.finishCombat(GameManager.attackGroup(bought,0,0))
    expect(GameManager.getWinner(won)).toBe('playerA')
  })
})

describe('spell rules', () => {
  it('keeps return fire in the spell zone until the caster turn ends', () => {
    const initial = GameManager.create(KEEP_ORDER_RANDOM)
    const returnFire = findDefinition(
      initial.state,
      'playerA',
      CARD_ID.RETURN_FIRE,
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
      CARD_ID.RETURN_FIRE,
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
        CARD_ID.OAKBARK_SENTINEL,
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

  it('heals with life droplet, keeps its barrier through the opponent turn, and expires it at the next own turn', () => {
    const initial = GameManager.create(KEEP_ORDER_RANDOM)
    const lifeDroplet = findDefinition(
      initial.state,
      'playerA',
      CARD_ID.LIFE_DROPLET,
    )
    expect(initial.state.cards[lifeDroplet].card).toMatchObject({
      name: '生命の雫',
      kind: 'spell',
      effect: { type: 'lifeDroplet', exileColor: 'blue' },
    })
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
      CARD_ID.EXHAUSTED_VOLCANO_DRAGON,
    )
    let manager = configureState(initial, {
      hands: { playerA: [lifeDroplet] },
      discards: { playerA: blueDiscards },
      board: [attacker],
      hp: { playerA: 10 },
    })

    manager = GameManager.playSpell(manager, lifeDroplet)
    expect(manager.state.players.playerA.hp).toBe(12)
    expect(manager.state.players.playerA.placedSpell).toEqual({
      cardId: lifeDroplet,
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
    expect(manager.state.players.playerA.discard).toContain(lifeDroplet)
    expect(GameManager.getPlayerBarrier(manager, 'playerA')).toBe(2)
  })

  it('gains abundance mana, allows attacks, and can be overwritten by another duration spell', () => {
    const initial = GameManager.create(KEEP_ORDER_RANDOM)
    const abundance = findDefinition(
      initial.state,
      'playerA',
      CARD_ID.ABUNDANCE,
    )
    const lifeDroplet = findDefinition(
      initial.state,
      'playerA',
      CARD_ID.LIFE_DROPLET,
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
      hands: { playerA: [abundance, lifeDroplet] },
      discards: { playerA: [...greenDiscards, redDiscard] },
      board: [attacker],
    })

    manager = GameManager.playSpell(manager, abundance)

    expect(manager.state.players.playerA.mana).toBe(3)
    expect(manager.state.players.playerA.exile).toEqual(greenDiscards)
    expect(manager.state.players.playerA.discard).toEqual([redDiscard])
    expect(GameManager.canCurrentPlayerAttack(manager)).toBe(true)

    manager = GameManager.playSpell(manager, lifeDroplet)
    expect(manager.state.players.playerA.placedSpell).toEqual({
      cardId: lifeDroplet,
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
    expect(manager.state.players.playerA.mana).toBe(3)
    expect(manager.state.players.playerA.placedSpell?.cardId).toBe(lifeDroplet)
    expect(() => assertValidGameState(manager.state)).not.toThrow()
  })

  it('expires abundance and removes all remaining mana at the end of its caster turn', () => {
    const initial = GameManager.create(KEEP_ORDER_RANDOM)
    const abundance = findDefinition(
      initial.state,
      'playerA',
      CARD_ID.ABUNDANCE,
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
      mana: { playerA: 2 },
    })

    manager = GameManager.playSpell(manager, abundance)
    expect(manager.state.players.playerA.mana).toBe(3)
    expect(GameManager.canCurrentPlayerAttack(manager)).toBe(true)
    manager = GameManager.passPhase(manager)
    manager = GameManager.passPhase(manager)
    manager = GameManager.passPhase(manager)

    expect(manager.state.activePlayerId).toBe('playerB')
    expect(manager.state.players.playerA.mana).toBe(0)
    expect(manager.state.players.playerA.placedSpell).toBeNull()
    expect(manager.state.players.playerA.discard).toContain(abundance)
    expect(manager.state.players.playerA.exile).toContain(greenDiscard)
  })

  it('destroys the red creatures in a chosen group and bypasses the enemy shield with fireball assault', () => {
    const initial = createThemeManager(THEME_DECK_IDS.RED_BLUE_SKIRMISH)
    const fireballAssault = findDefinition(
      initial.state,
      'playerA',
      CARD_ID.FIREBALL_ASSAULT,
    )
    const redCreature = findDefinition(
      initial.state,
      'playerA',
      CARD_ID.SPARK_SWORDSMAN,
    )
    const vanishingRedCreature = findDefinition(
      initial.state,
      'playerA',
      CARD_ID.EXHAUSTED_VOLCANO_DRAGON,
    )
    const blueCreature = findDefinition(
      initial.state,
      'playerA',
      CARD_ID.TIDEWAY_SCOUT,
    )
    let manager = configureState(initial, {
      hands: { playerA: [fireballAssault] },
      board: [redCreature, vanishingRedCreature, blueCreature],
    })

    expect(GameManager.getSpellPlayActions(manager, fireballAssault)).toEqual([
      {
        type: 'playSpell',
        cardId: fireballAssault,
        target: { kind: 'group', startIndex: 0, endIndex: 2 },
      },
    ])
    expect(() => GameManager.playSpell(manager, fireballAssault)).toThrow(
      'The selected spell target is not valid.',
    )

    manager = GameManager.playSpell(manager, fireballAssault, {
      kind: 'group',
      startIndex: 0,
      endIndex: 2,
    })

    expect(manager.state.pendingCombat).toMatchObject({
      damageMarkers: [],
      destroyedCardIds: [redCreature, vanishingRedCreature],
      defendingPlayerId: 'playerB',
      playerWasHit: true,
      playerDamage: 7,
      endsTurnAfterResolution: false,
    })
    expect(manager.state.players.playerB.hp).toBe(20)
    expect(GameManager.getDestructionManaRefund(manager, redCreature)).toBe(1)
    expect(GameManager.getDestructionManaRefund(manager, vanishingRedCreature)).toBe(0)

    manager = GameManager.finishCombat(manager)

    expect(manager.state.players.playerB.hp).toBe(13)
    expect(manager.state.players.playerA.mana).toBe(1)
    expect(manager.state.board.creatures.map(({ cardId }) => cardId)).toEqual([
      blueCreature,
    ])
    expect(manager.state.players.playerA.placedSpell?.cardId).toBe(fireballAssault)
  })

  it('moves a chosen blue creature next to the player with less HP', () => {
    const initial = createThemeManager(THEME_DECK_IDS.BLUE_GREEN_INTERCEPT)
    const transfer = findDefinition(initial.state, 'playerA', CARD_ID.TRANSFER)
    const greenCreature = findDefinition(
      initial.state,
      'playerA',
      CARD_ID.OAKBARK_SENTINEL,
    )
    const blueCreature = findDefinition(
      initial.state,
      'playerA',
      CARD_ID.TIDEWAY_SCOUT,
    )
    const enemyCreature = findDefinition(
      initial.state,
      'playerB',
      CARD_ID.SPARK_SWORDSMAN,
    )
    let manager = configureState(initial, {
      hands: { playerA: [transfer] },
      board: [greenCreature, blueCreature, enemyCreature],
      hp: { playerA: 20, playerB: 12 },
    })

    expect(GameManager.getSpellPlayActions(manager, transfer)).toEqual([
      {
        type: 'playSpell',
        cardId: transfer,
        target: { kind: 'creature', cardId: blueCreature },
      },
    ])
    manager = GameManager.playSpell(manager, transfer, {
      kind: 'creature',
      cardId: blueCreature,
    })

    expect(manager.state.board.creatures.map(({ cardId }) => cardId)).toEqual([
      greenCreature,
      enemyCreature,
      blueCreature,
    ])
    expect(manager.state.board.creatures.at(-1)?.summonedTurn).toBe(9)
    expect(manager.state.players.playerA.placedSpell?.cardId).toBe(transfer)
  })

  it('uses transfer without moving its target when both players have equal HP', () => {
    const initial = createThemeManager(THEME_DECK_IDS.BLUE_GREEN_INTERCEPT)
    const transfer = findDefinition(initial.state, 'playerA', CARD_ID.TRANSFER)
    const blueCreature = findDefinition(
      initial.state,
      'playerA',
      CARD_ID.TIDEWAY_SCOUT,
    )
    let manager = configureState(initial, {
      hands: { playerA: [transfer] },
      board: [blueCreature],
      hp: { playerA: 15, playerB: 15 },
    })

    manager = GameManager.playSpell(manager, transfer, {
      kind: 'creature',
      cardId: blueCreature,
    })

    expect(manager.state.board.creatures.map(({ cardId }) => cardId)).toEqual([
      blueCreature,
    ])
    expect(manager.state.players.playerA.hand).toEqual([])
    expect(manager.state.players.playerA.placedSpell?.cardId).toBe(transfer)
  })

  it('destroys every own green creature and refunds full cost with life cycle', () => {
    const initial = createThemeManager(THEME_DECK_IDS.GREEN_RED_FRONTLINE)
    const lifeCycle = findDefinition(initial.state, 'playerA', CARD_ID.LIFE_CYCLE)
    const greenCreature = findDefinition(
      initial.state,
      'playerA',
      CARD_ID.OAKBARK_SENTINEL,
    )
    const vanishingGreenCreature = findDefinition(
      initial.state,
      'playerA',
      CARD_ID.DREAMWALKING_FOREST_GIANT,
    )
    const redCreature = findDefinition(
      initial.state,
      'playerA',
      CARD_ID.SPARK_SWORDSMAN,
    )
    let manager = configureState(initial, {
      hands: { playerA: [lifeCycle] },
      board: [greenCreature, redCreature, vanishingGreenCreature],
    })

    manager = GameManager.playSpell(manager, lifeCycle)

    expect(manager.state.pendingCombat).toMatchObject({
      damageMarkers: [],
      destroyedCardIds: [greenCreature, vanishingGreenCreature],
      destructionManaRefunds: {
        [greenCreature]: 2,
        [vanishingGreenCreature]: 5,
      },
      defendingPlayerId: 'playerA',
      playerWasHit: false,
      playerDamage: 0,
      endsTurnAfterResolution: false,
    })
    expect(GameManager.getDestructionManaRefund(manager, greenCreature)).toBe(2)
    expect(GameManager.getDestructionManaRefund(manager, vanishingGreenCreature)).toBe(5)

    manager = GameManager.finishCombat(manager)

    expect(manager.state.players.playerA.mana).toBe(7)
    expect(manager.state.board.creatures.map(({ cardId }) => cardId)).toEqual([
      redCreature,
    ])
    expect(manager.state.players.playerA.discard).toEqual(
      expect.arrayContaining([greenCreature, vanishingGreenCreature]),
    )
    expect(manager.state.players.playerA.placedSpell?.cardId).toBe(lifeCycle)
    expect(() => assertValidGameState(manager.state)).not.toThrow()
  })

  it('damages the chosen creature group and both adjacent groups with self-destruct order', () => {
    const initial = createSelfDestructManager()
    const selfDestructOrder = findDefinition(
      initial.state,
      'playerA',
      CARD_ID.SELF_DESTRUCT_ORDER,
    )
    const selectedDragon = findDefinition(
      initial.state,
      'playerA',
      CARD_ID.EXHAUSTED_VOLCANO_DRAGON,
    )
    const survivingWhale = findDefinition(
      initial.state,
      'playerA',
      CARD_ID.EPHEMERAL_DEEP_WHALE,
    )
    const unaffectedScout = findDefinition(
      initial.state,
      'playerA',
      CARD_ID.TIDEWAY_SCOUT,
    )
    const [leftEnemy, rightEnemy] = findCardIds(
      initial.state,
      'playerB',
      (cardId) =>
        initial.state.cards[cardId].card.definitionId === CARD_ID.SPARK_SWORDSMAN,
      2,
    )
    let manager = configureState(initial, {
      hands: { playerA: [selfDestructOrder] },
      board: [
        leftEnemy,
        selectedDragon,
        survivingWhale,
        rightEnemy,
        unaffectedScout,
      ],
      mana: { playerA: 0 },
    })

    expect(GameManager.getSpellPlayActions(manager, selfDestructOrder)).toEqual([
      {
        type: 'playSpell',
        cardId: selfDestructOrder,
        target: { kind: 'creature', cardId: selectedDragon },
      },
      {
        type: 'playSpell',
        cardId: selfDestructOrder,
        target: { kind: 'creature', cardId: survivingWhale },
      },
      {
        type: 'playSpell',
        cardId: selfDestructOrder,
        target: { kind: 'creature', cardId: unaffectedScout },
      },
    ])

    manager = GameManager.playSpell(manager, selfDestructOrder, {
      kind: 'creature',
      cardId: selectedDragon,
    })

    expect(manager.state.players.playerA.mana).toBe(0)
    expect(manager.state.players.playerA.placedSpell).toEqual({
      cardId: selfDestructOrder,
      effectAmount: 0,
    })
    expect(manager.state.pendingCombat).toMatchObject({
      damageMarkers: [
        { cardId: leftEnemy, damage: 5 },
        { cardId: selectedDragon, damage: 5 },
        { cardId: survivingWhale, damage: 5 },
        { cardId: rightEnemy, damage: 5 },
      ],
      destroyedCardIds: [leftEnemy, selectedDragon, rightEnemy],
      playerWasHit: false,
      playerDamage: 0,
      endsTurnAfterResolution: false,
    })
    expect(manager.state.players.playerA.hp).toBe(20)
    expect(manager.state.players.playerB.hp).toBe(20)

    manager = GameManager.finishCombat(manager)

    expect(manager.state.turn).toBe(10)
    expect(manager.state.activePlayerId).toBe('playerA')
    expect(manager.state.phase).toBe('main')
    expect(manager.state.board.creatures.map(({ cardId }) => cardId)).toEqual([
      survivingWhale,
      unaffectedScout,
    ])
    expect(manager.state.players.playerA.mana).toBe(0)
    expect(manager.state.players.playerB.mana).toBe(2)
    expect(manager.state.players.playerA.discard).toContain(selectedDragon)
    expect(manager.state.players.playerB.discard).toEqual(
      expect.arrayContaining([leftEnemy, rightEnemy]),
    )
    expect(() => assertValidGameState(manager.state)).not.toThrow()
  })
})
