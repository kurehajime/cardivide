import { describe, expect, it } from 'vitest'
import { GameManager } from '../GameManager'
import type { GameState } from '../types'
import { GameAI } from './GameAI'
import { AI_EVALUATION_PARAMETERS, evaluateBase } from './evaluation'

const KEEP_ORDER_RANDOM = () => 1 - Number.EPSILON

const createTestManager = (): GameManager => GameManager.create(KEEP_ORDER_RANDOM)

const withState = (
  manager: GameManager,
  update: (state: GameState) => GameState,
): GameManager => GameManager.from(update(manager.state))

describe('GameManager AI rule APIs', () => {
  it('only enumerates main actions that can be applied', () => {
    const manager = createTestManager()
    const actions = GameManager.getLegalActions(manager)

    expect(actions.length).toBeGreaterThan(1)
    expect(actions.at(-1)).toEqual({ type: 'passPhase' })
    actions.forEach((action) => {
      expect(() => GameManager.applyAction(manager, action)).not.toThrow()
    })
  })

  it('previews combat without advancing the turn or mutating the source state', () => {
    const manager = createTestManager()
    const cardId = manager.state.players.playerA.hand[0]
    const summoned = GameManager.summonCreature(manager, cardId, 0)
    const preview = GameManager.previewCombat(summoned, 0, 0)

    expect(preview.attackerId).toBe('playerA')
    expect(preview.playerDamage).toBe(1)
    expect(preview.nextState.turn).toBe(summoned.state.turn)
    expect(preview.nextState.activePlayerId).toBe('playerA')
    expect(preview.nextState.players.playerB.hp).toBe(19)
    expect(preview.nextState.pendingCombat).toBeNull()
    expect(summoned.state.players.playerB.hp).toBe(20)
    expect(summoned.state.pendingCombat).toBeNull()
  })

  it('stops combat resolution immediately when a player wins', () => {
    const manager = createTestManager()
    const cardId = manager.state.players.playerA.hand[0]
    const summoned = GameManager.summonCreature(manager, cardId, 0)
    const lethalState = withState(summoned, (state) => ({
      ...state,
      phase: 'battle',
      players: {
        ...state.players,
        playerB: { ...state.players.playerB, hp: 1 },
      },
    }))
    const resolved = GameManager.finishCombat(
      GameManager.attackGroup(lethalState, 0, 0),
    )

    expect(GameManager.getWinner(resolved)).toBe('playerA')
    expect(resolved.state.turn).toBe(lethalState.state.turn)
    expect(resolved.state.activePlayerId).toBe('playerA')
    expect(resolved.state.players.playerB.hp).toBe(0)
    expect(GameManager.getLegalActions(resolved)).toEqual([])
  })
})

describe('AI evaluation', () => {
  it('uses asymmetric terminal scores and zeros the other components', () => {
    const manager = createTestManager()
    const won = withState(manager, (state) => ({
      ...state,
      players: {
        ...state.players,
        playerB: { ...state.players.playerB, hp: 0 },
      },
    }))
    const lost = withState(manager, (state) => ({
      ...state,
      players: {
        ...state.players,
        playerA: { ...state.players.playerA, hp: 0 },
      },
    }))

    expect(evaluateBase(won, 'playerA')).toEqual({
      terminal: AI_EVALUATION_PARAMETERS.victory,
      hp: 0,
      mana: 0,
      boardMaterial: 0,
      handReserve: 0,
      deployableHand: 0,
      upkeepMana: 0,
      marchControl: 0,
      myAttackPotential: 0,
      opponentAttackThreat: 0,
      total: AI_EVALUATION_PARAMETERS.victory,
    })
    expect(evaluateBase(lost, 'playerA').total).toBe(
      AI_EVALUATION_PARAMETERS.defeat,
    )
    expect(Math.abs(AI_EVALUATION_PARAMETERS.victory)).toBeGreaterThan(
      Math.abs(AI_EVALUATION_PARAMETERS.defeat),
    )
  })

  it('values only the AI hand at 0.3 times printed cost', () => {
    const manager = createTestManager()
    const expectedReserve = manager.state.players.playerA.hand.reduce(
      (total, cardId) => total + manager.state.cards[cardId].card.cost * 0.3,
      0,
    )
    const opponentWithHand = withState(manager, (state) => ({
      ...state,
      players: {
        ...state.players,
        playerB: {
          ...state.players.playerB,
          hand: state.players.playerB.deck.slice(0, 5),
          deck: state.players.playerB.deck.slice(5),
        },
      },
    }))

    expect(evaluateBase(manager, 'playerA').handReserve).toBeCloseTo(expectedReserve)
    expect(evaluateBase(opponentWithHand, 'playerA').handReserve).toBeCloseTo(
      expectedReserve,
    )
  })

  it('keeps the total equal to the sum of its components', () => {
    const evaluation = GameAI.evaluate(createTestManager(), 'playerA')
    const { total, ...components } = evaluation

    expect(total).toBeCloseTo(
      Object.values(components).reduce((sum, value) => sum + value, 0),
    )
  })
})

describe('GameAI action selection', () => {
  it('completes a turn using only enumerated legal actions', () => {
    let manager = createTestManager()
    const startingPlayerId = manager.state.activePlayerId

    for (let actionCount = 0; actionCount < 10; actionCount += 1) {
      const action = GameAI.chooseAction(manager)
      expect(action).not.toBeNull()
      expect(GameManager.getLegalActions(manager)).toContainEqual(action)
      manager = GameManager.applyAction(manager, action!)

      if (manager.state.activePlayerId !== startingPlayerId) {
        break
      }
    }

    expect(manager.state.activePlayerId).not.toBe(startingPlayerId)
    expect(manager.state.phase).toBe('main')
  })

  it('chooses a useful summon during the main phase', () => {
    const action = GameAI.chooseAction(createTestManager())

    expect(action?.type).toBe('summonCreature')
  })

  it('chooses a lethal attack during the battle phase', () => {
    const manager = createTestManager()
    const cardId = manager.state.players.playerA.hand[0]
    const summoned = GameManager.summonCreature(manager, cardId, 0)
    const battle = withState(summoned, (state) => ({
      ...state,
      phase: 'battle',
      players: {
        ...state.players,
        playerB: { ...state.players.playerB, hp: 1 },
      },
    }))

    expect(GameAI.chooseAction(battle)).toEqual({
      type: 'attackGroup',
      startIndex: 0,
      endIndex: 0,
    })
  })

  it('passes when no battle attack is available', () => {
    const battle = GameManager.setPhase(createTestManager(), 'battle')

    expect(GameAI.chooseAction(battle)).toEqual({ type: 'passPhase' })
  })
})
