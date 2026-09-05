import { describe, expect, it } from 'vitest'
import { CreatureRules, describeAbility, formatAbility } from './CreatureRules'
import { GameManager, assertValidGameState } from './GameManager'
import { CARD_DEFINITION_IDS as ID, EXPANSION_CARD_DEFINITION_IDS } from './cards'
import { GameAI } from './ai/GameAI'
import { evaluateBase, evaluateBattleEntry } from './ai/evaluation'
import { estimateBombardment } from './ai/bombardmentRisk'
import type { CardDefinitionId, Phase, PlayerId } from './types'

type BoardEntry = [PlayerId, CardDefinitionId]

const createPosition = ({
  board = [],
  hand = [],
  enemyHand = [],
  activePlayerId = 'playerA',
  phase = 'main',
  hp = [20, 20],
  mana = 0,
}: {
  board?: BoardEntry[]
  hand?: CardDefinitionId[]
  enemyHand?: CardDefinitionId[]
  activePlayerId?: PlayerId
  phase?: Phase
  hp?: [number, number]
  mana?: number
} = {}): GameManager => {
  const decks = {
    playerA: [...board.filter(([owner]) => owner === 'playerA').map(([, id]) => id), ...hand],
    playerB: [...board.filter(([owner]) => owner === 'playerB').map(([, id]) => id), ...enemyHand],
  }
  const initial = GameManager.create(() => 0.999, decks)
  const remaining = Object.values(initial.state.cards)
  const creatures = board.map(([owner, definitionId]) => {
    const index = remaining.findIndex((card) =>
      card.ownerId === owner && card.card.definitionId === definitionId)
    return { cardId: remaining.splice(index, 1)[0].id, summonedTurn: 1 }
  })
  const preparePlayer = (id: PlayerId, index: 0 | 1) => ({
    ...initial.state.players[id],
    hp: hp[index],
    mana,
    hand: remaining.filter((card) => card.ownerId === id).map((card) => card.id),
    deck: [],
  })
  const players = {
    playerA: preparePlayer('playerA', 0),
    playerB: preparePlayer('playerB', 1),
  }
  return GameManager.from({
    ...initial.state, turn: 10, activePlayerId, phase, players,
    board: { creatures },
  })
}

const passTurn = (manager: GameManager): GameManager => {
  const turn = manager.state.turn
  while (manager.state.turn === turn && GameManager.getWinner(manager) === null) {
    manager = manager.state.pendingCombat
      ? GameManager.finishCombat(manager)
      : GameManager.passPhase(manager)
  }
  return manager
}

describe('bombardment rules', () => {
  it('registers Cannon as a scenario reward and describes its shared keyword', () => {
    expect(EXPANSION_CARD_DEFINITION_IDS).toContain(ID.CANNON)
    expect(formatAbility({ type: 'bombardment', damage: 6 })).toBe('砲撃6')
    expect(describeAbility({ type: 'bombardment', damage: 6 })).toContain('シールドの影響は受けない')
  })

  it('fires only on the next own upkeep, once, and shows damage before resolving it', () => {
    const initial = createPosition({ hand: [ID.CANNON], mana: 2 })
    const cannon = initial.state.players.playerA.hand[0]
    const summoned = GameManager.summonCreature(initial, cannon, 0)
    expect(summoned.state.pendingCombat).toBeNull()
    const opponentTurn = passTurn(summoned)
    expect(opponentTurn.state.activePlayerId).toBe('playerB')
    expect(opponentTurn.state.pendingCombat).toBeNull()
    const pending = passTurn(opponentTurn)
    expect(pending.state.activePlayerId).toBe('playerA')
    expect(pending.state.pendingCombat).toMatchObject({
      playerWasHit: true, playerDamage: 6,
      defendingPlayerId: 'playerB', endsTurnAfterResolution: false,
    })
    expect(pending.state.players.playerB.hp).toBe(20)
    expect(GameManager.getLegalActions(pending)).toEqual([{ type: 'finishCombat' }])
    const resolved = GameManager.finishCombat(pending)
    expect(resolved.state.players.playerB.hp).toBe(14)
    expect(resolved.state.phase).toBe('main')
    expect(resolved.state.activePlayerId).toBe('playerA')
    expect(resolved.state.turn).toBe(pending.state.turn)
    expect(resolved.state.hasAttackedThisTurn).toBe(false)
    expect(resolved.state.players.playerA.mana).toBe(2)
    expect(() => GameManager.resolveKeepUp(resolved)).toThrow()
    expect(initial.state.players.playerB.hp).toBe(20)
  })

  it.each(['playerA', 'playerB'] as const)('stacks each %s cannon and ignores shields', (owner) => {
    const other = owner === 'playerA' ? 'playerB' : 'playerA'
    const manager = createPosition({
      board: [[owner, ID.CANNON], [owner, ID.CANNON], [other, ID.CANNON]],
      activePlayerId: owner, phase: 'keepUp',
    })
    expect(GameManager.getPlayerBarrier(manager, other)).toBe(2)
    expect(GameManager.getKeepUpPlayerDamage(manager, owner)).toBe(12)
    const resolved = GameManager.finishCombat(GameManager.resolveKeepUp(manager))
    expect(resolved.state.players[other].hp).toBe(8)
    expect(resolved.state.players[owner].hp).toBe(20)
    expect(() => assertValidGameState(resolved.state)).not.toThrow()
  })

  it('ends the game on lethal bombardment without another action or another tick', () => {
    const manager = createPosition({
      board: [['playerA', ID.CANNON], ['playerB', ID.CANNON]],
      phase: 'keepUp', hp: [6, 6],
    })
    const resolved = GameManager.finishCombat(GameManager.resolveKeepUp(manager))
    expect(GameManager.getWinner(resolved)).toBe('playerA')
    expect(resolved.state.players.playerA.hp).toBe(6)
    expect(new GameAI().chooseAction(resolved)).toBeNull()
  })

  it('does not fire a cannon destroyed before its upkeep', () => {
    const manager = createPosition({
      board: [['playerA', ID.SPARK_SWORDSMAN], ['playerB', ID.CANNON]],
      hp: [3, 20],
    })
    const resolved = GameManager.finishCombat(GameManager.attackGroup(manager, 0, 0))
    expect(resolved.state.players.playerA.hp).toBe(3)
    expect(resolved.state.pendingCombat).toBeNull()
    expect(GameManager.getKeepUpPlayerDamage(resolved, 'playerB')).toBe(0)
    expect(resolved.state.players.playerB.discard).toHaveLength(1)
  })

  it('refunds one mana for a destroyed cannon in both the AI preview and real combat', () => {
    const manager = createPosition({
      board: [['playerA', ID.SPARK_SWORDSMAN], ['playerB', ID.CANNON]], mana: 4,
    })
    const cannon = manager.state.board.creatures[1].cardId
    expect(GameManager.getDestructionManaRefund(manager, cannon)).toBe(1)
    const preview = GameManager.previewCombat(manager, 0, 0)
    expect(preview.nextState.players.playerB.mana).toBe(5)
    expect(preview.nextState.players.playerB.discard).toContain(cannon)
    const resolved = GameManager.finishCombat(GameManager.attackGroup(manager, 0, 0))
    expect(resolved.state.players.playerB.mana).toBe(7)
    expect(resolved.state.players.playerB.discard).toContain(cannon)
    expect(resolved.state.pendingCombat).toBeNull()
  })

  it('does not start an enemy upkeep after a winning attack', () => {
    const manager = createPosition({
      board: [['playerB', ID.CANNON], ['playerA', ID.EXHAUSTED_VOLCANO_DRAGON]],
      hp: [3, 5],
    })
    const resolved = GameManager.finishCombat(GameManager.attackGroup(manager, 1, 1))
    expect(GameManager.getWinner(resolved)).toBe('playerA')
    expect(resolved.state.players.playerA.hp).toBe(3)
    expect(resolved.state.pendingCombat).toBeNull()
    expect(resolved.state.turn).toBe(manager.state.turn)
  })

  it('uses the new controller after bribery', () => {
    const manager = createPosition({
      board: [['playerB', ID.CANNON]], hand: [ID.BRIBERY], mana: 3,
    })
    const cannon = manager.state.board.creatures[0].cardId
    const bought = GameManager.playSpell(manager, manager.state.players.playerA.hand[0], {
      kind: 'creature', cardId: cannon,
    })
    expect(GameManager.getKeepUpPlayerDamage(bought, 'playerA')).toBe(6)
    expect(GameManager.getKeepUpPlayerDamage(bought, 'playerB')).toBe(0)
    const enemyTurn = passTurn(bought)
    expect(enemyTurn.state.pendingCombat).toBeNull()
    const fired = GameManager.finishCombat(passTurn(enemyTurn))
    expect(fired.state.players.playerA.hp).toBe(20)
    expect(fired.state.players.playerB.hp).toBe(14)
    expect(new CreatureRules(bought.state, 0).ownerId).toBe('playerA')
  })
})

describe('bombardment AI', () => {
  it('discounts an exposed cannon without inspecting enemy card identities', () => {
    const make = (enemyCard: CardDefinitionId) => createPosition({
      board: [['playerA', ID.CANNON]], enemyHand: [enemyCard],
    })
    const manager = make(ID.SPARK_SWORDSMAN)
    expect(estimateBombardment(manager, 'playerA').damage).toBeCloseTo(0.6)
    expect(estimateBombardment(manager, 'playerA').protectedDamage).toBe(0)
    expect(estimateBombardment(make(ID.RETURN_FIRE), 'playerA')).toEqual(
      estimateBombardment(manager, 'playerA'),
    )
    expect(evaluateBase(manager, 'playerA').upkeepDamage).toBeCloseTo(1.8)
    expect(manager.state.players.playerB.hp).toBe(20)
  })

  it.each(['playerA', 'playerB'] as const)('uses reachable insertion slots and front defense for %s', (owner) => {
    const board: BoardEntry[] = [
      [owner, ID.CANNON], [owner, ID.OAKBARK_SENTINEL], [owner, ID.OAKBARK_SENTINEL],
    ]
    if (owner === 'playerB') board.reverse()
    const manager = createPosition({
      board, hand: [ID.SPARK_SWORDSMAN], enemyHand: [ID.SPARK_SWORDSMAN],
    })
    expect(estimateBombardment(manager, owner)).toEqual({ damage: 6, protectedDamage: 6 })
    const withoutFront = createPosition({
      board: board.filter((_, index) => index !== (owner === 'playerA' ? 2 : 0)),
      hand: [ID.SPARK_SWORDSMAN], enemyHand: [ID.SPARK_SWORDSMAN],
    })
    expect(estimateBombardment(withoutFront, owner).damage).toBeCloseTo(0.6)
  })

  it('uses capture when judging whether a defender can be bypassed', () => {
    const manager = createPosition({
      board: [['playerA', ID.CANNON], ['playerA', ID.VINE_SNARE_HUNTER]],
      enemyHand: [ID.SPARK_SWORDSMAN],
    })
    expect(GameManager.getRequiredMarchForInsert(manager, 'playerB', 1)).toBe(2)
    expect(estimateBombardment(manager, 'playerA').damage).toBe(6)
  })

  it('counts unknown draws as reinforcement risk, but not an empty hand and deck', () => {
    const manager = createPosition({
      board: [['playerA', ID.CANNON]], enemyHand: [ID.SPARK_SWORDSMAN],
    })
    const enemy = manager.state.players.playerB
    const beforeDraw = GameManager.from({
      ...manager.state,
      players: {
        ...manager.state.players,
        playerB: { ...enemy, hand: [], deck: enemy.hand },
      },
    })
    expect(estimateBombardment(beforeDraw, 'playerA').damage).toBeCloseTo(0.6)
    const exhausted = createPosition({ board: [['playerA', ID.CANNON]] })
    expect(estimateBombardment(exhausted, 'playerA').damage).toBe(6)
  })

  it('prefers an immediate attacker over an unsupported opening cannon', () => {
    const manager = createPosition({
      hand: [ID.CANNON, ID.SPARK_SWORDSMAN], enemyHand: [ID.SPARK_SWORDSMAN], mana: 2,
    })
    expect(new GameAI().chooseAction(manager)).toMatchObject({
      type: 'summonCreature', cardId: manager.state.players.playerA.hand[1],
    })
  })

  it('credits the discounted tick only once and leaves the real state unchanged', () => {
    const manager = createPosition({
      board: [['playerA', ID.CANNON]], enemyHand: [ID.SPARK_SWORDSMAN],
    })
    const snapshot = JSON.stringify(manager.state)
    expect(evaluateBattleEntry(manager, 'playerA').total).toBeCloseTo(3.8)
    const enemyTurn = GameManager.from({ ...manager.state, activePlayerId: 'playerB' })
    expect(evaluateBattleEntry(enemyTurn, 'playerA').total).toBeCloseTo(4.4)
    expect(JSON.stringify(manager.state)).toBe(snapshot)
  })

  it('discounts each source independently instead of discarding a whole group', () => {
    const manager = createPosition({
      board: [
        ['playerA', ID.CANNON], ['playerA', ID.OAKBARK_SENTINEL],
        ['playerA', ID.OAKBARK_SENTINEL], ['playerA', ID.CANNON],
      ],
      enemyHand: [ID.SPARK_SWORDSMAN],
    })
    expect(estimateBombardment(manager, 'playerA')).toEqual({ damage: 6.6, protectedDamage: 6 })
  })

  it('does not call an exposed future bombardment a guaranteed victory', () => {
    const manager = createPosition({
      board: [['playerA', ID.CANNON]], enemyHand: [ID.SPARK_SWORDSMAN], hp: [20, 1],
      activePlayerId: 'playerB',
    })
    expect(evaluateBattleEntry(manager, 'playerA').total).toBeLessThan(1000)
  })

  it('does not discount actual upkeep damage or a lethal shot immediately after its attack', () => {
    const manager = createPosition({
      board: [['playerB', ID.CANNON]], hand: [ID.SPARK_SWORDSMAN], hp: [6, 20], phase: 'battle',
    })
    expect(evaluateBattleEntry(manager, 'playerA').total).toBe(-10_000)
    const pending = passTurn(manager)
    expect(pending.state.pendingCombat?.playerDamage).toBe(6)
    expect(GameManager.getWinner(GameManager.finishCombat(pending))).toBe('playerB')
  })

  it('values a future tick at 0.75, then counts an imminent tick only as HP', () => {
    const ownTurn = createPosition({ board: [['playerA', ID.CANNON]] })
    expect(evaluateBase(ownTurn, 'playerA').upkeepDamage).toBe(18)
    expect(evaluateBattleEntry(ownTurn, 'playerA').total).toBe(20)
    const enemyTurn = GameManager.from({ ...ownTurn.state, activePlayerId: 'playerB' })
    expect(evaluateBattleEntry(enemyTurn, 'playerA').total).toBe(26)
    expect(ownTurn.state.players.playerB.hp).toBe(20)
  })

  it('summons a cannon even though its attack is zero', () => {
    const manager = createPosition({ hand: [ID.CANNON], mana: 2 })
    expect(new GameAI().chooseAction(manager)).toMatchObject({
      type: 'summonCreature', cardId: manager.state.players.playerA.hand[0],
    })
  })

  it('kills an enemy cannon to prevent lethal damage at the turn boundary', () => {
    const manager = createPosition({
      board: [['playerA', ID.SPARK_SWORDSMAN], ['playerB', ID.CANNON]],
      phase: 'battle', hp: [3, 20],
    })
    expect(new GameAI().chooseAction(manager)).toEqual({
      type: 'attackGroup', startIndex: 0, endIndex: 0,
    })
  })

  it('does not expect its own later cannon to save it from an earlier lethal tick', () => {
    const manager = createPosition({
      board: [['playerA', ID.CANNON], ['playerB', ID.CANNON]], hp: [3, 3],
    })
    expect(evaluateBattleEntry(manager, 'playerA').total).toBe(-10_000)
    expect(evaluateBattleEntry(manager, 'playerB').total).toBe(20_000)
  })

  it('takes a winning attack before an enemy cannon can fire', () => {
    const manager = createPosition({
      board: [['playerB', ID.CANNON], ['playerA', ID.EXHAUSTED_VOLCANO_DRAGON]],
      phase: 'battle', hp: [3, 5],
    })
    expect(evaluateBattleEntry(manager, 'playerA').total).toBe(20_000)
    expect(new GameAI().chooseAction(manager)).toEqual({
      type: 'attackGroup', startIndex: 1, endIndex: 1,
    })
  })

  it('chooses to destroy the cannon instead of damaging the player when its tick is lethal', () => {
    const manager = createPosition({
      board: [['playerB', ID.SPARK_SWORDSMAN], ['playerA', ID.CANNON], ['playerB', ID.SPARK_SWORDSMAN]],
      activePlayerId: 'playerB', phase: 'battle', hp: [20, 3],
    })
    expect(new GameAI().chooseAction(manager)).toEqual({
      type: 'attackGroup', startIndex: 2, endIndex: 2,
    })
  })

  it('prefers a cannon behind a defender to one exposed to a lethal attack', () => {
    const protectedPosition = createPosition({
      board: [['playerA', ID.CANNON], ['playerA', ID.ROOTED_ANCIENT], ['playerB', ID.SPARK_SWORDSMAN]],
    })
    const exposed = createPosition({
      board: [['playerA', ID.ROOTED_ANCIENT], ['playerA', ID.CANNON], ['playerB', ID.SPARK_SWORDSMAN]],
    })
    expect(evaluateBattleEntry(protectedPosition, 'playerA').total).toBeGreaterThan(
      evaluateBattleEntry(exposed, 'playerA').total,
    )
  })

  it('does not subtract an unearned future victory when an exposed cannon can be killed', () => {
    const manager = createPosition({
      board: [['playerA', ID.CANNON], ['playerB', ID.SPARK_SWORDSMAN]], hp: [20, 3],
    })
    const evaluation = evaluateBattleEntry(manager, 'playerA')
    expect(evaluation.opponentAttackThreat).toBeLessThan(100)
    expect(evaluation.total).toBeGreaterThan(0)
  })
})
