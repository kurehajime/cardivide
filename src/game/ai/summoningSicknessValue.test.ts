import { describe, expect, it } from 'vitest'
import { CARD_DEFINITION_IDS } from '../cards'
import { GameManager } from '../GameManager'
import type { CardDefinitionId, PlayerId } from '../types'
import { GameAI } from './GameAI'
import { evaluateBase } from './evaluation'

// Keep coverage independent of whether any released card has this ability.
const withSicknessFixture = (manager: GameManager): GameManager => GameManager.from({
  ...manager.state,
  cards: Object.fromEntries(Object.entries(manager.state.cards).map(([id, instance]) => [
    id,
    instance.card.definitionId === CARD_DEFINITION_IDS.WORLD_SERPENT && instance.card.kind === 'creature'
      ? { ...instance, card: { ...instance.card, name: '召喚酔い検証用', cost: 6, attack: 12, defense: 12, abilities: [{ type: 'summoningSickness' as const }] } }
      : instance,
  ])),
})

const createHandManager = (
  definitionId: CardDefinitionId = CARD_DEFINITION_IDS.WORLD_SERPENT,
): GameManager => {
  const initial = withSicknessFixture(GameManager.create(() => 0.999, {
    playerA: [definitionId],
    playerB: [],
  }))
  return GameManager.from({
    ...initial.state,
    turn: 10,
    phase: 'main',
    activePlayerId: 'playerA',
    players: {
      ...initial.state.players,
      playerA: { ...initial.state.players.playerA, mana: 6 },
    },
  })
}

const summonHandCreature = (manager: GameManager): GameManager =>
  GameManager.summonCreature(
    manager,
    manager.state.players.playerA.hand[0],
    0,
  )

describe('summoning sickness future value', () => {
  it('values a newly summoned test creature at its six mana cost plus nine future attack points', () => {
    const summoned = summonHandCreature(createHandManager())
    const cardId = summoned.state.board.creatures[0].cardId

    expect(GameManager.getCreatureStats(summoned, cardId).attack).toBe(0)
    expect(evaluateBase(summoned, 'playerA').boardMaterial).toBe(15)
  })

  it.each<PlayerId>(['playerA', 'playerB'])(
    'scores future value symmetrically when the active player is %s',
    (activePlayerId) => {
      const summoned = summonHandCreature(createHandManager())
      const manager = GameManager.from({ ...summoned.state, activePlayerId })

      expect(evaluateBase(manager, 'playerA').boardMaterial).toBe(15)
      expect(evaluateBase(manager, 'playerB').boardMaterial).toBe(-15)
    },
  )

  it('stops awarding the reserve when the creature can attack on a later turn', () => {
    const summoned = summonHandCreature(createHandManager())
    const nextTurn = GameManager.from({ ...summoned.state, turn: 11 })
    const cardId = nextTurn.state.board.creatures[0].cardId

    expect(GameManager.getCreatureStats(nextTurn, cardId).attack).toBe(12)
    expect(evaluateBase(nextTurn, 'playerA').boardMaterial).toBe(6)
  })

  it('does not award the reserve to a creature without summoning sickness', () => {
    const summoned = summonHandCreature(
      createHandManager(CARD_DEFINITION_IDS.SPARK_SWORDSMAN),
    )
    const cardId = summoned.state.board.creatures[0].cardId

    expect(GameManager.getCreatureStats(summoned, cardId).attack).toBe(3)
    expect(evaluateBase(summoned, 'playerA').boardMaterial).toBe(2)
  })

  it('removes the reserve when the enemy combat preview destroys the sleeping creature', () => {
    const initial = withSicknessFixture(GameManager.create(() => 0.999, {
      playerA: [CARD_DEFINITION_IDS.WORLD_SERPENT],
      playerB: [CARD_DEFINITION_IDS.WORLD_SERPENT],
    }))
    const defenderId = Object.values(initial.state.cards).find(
      ({ ownerId }) => ownerId === 'playerA',
    )!.id
    const attackerId = Object.values(initial.state.cards).find(
      ({ ownerId }) => ownerId === 'playerB',
    )!.id
    const manager = GameManager.from({
      ...initial.state,
      activePlayerId: 'playerB',
      phase: 'battle',
      turn: 10,
      players: {
        playerA: { ...initial.state.players.playerA, hand: [], deck: [], mana: 0 },
        playerB: { ...initial.state.players.playerB, hand: [], deck: [], mana: 0 },
      },
      board: {
        creatures: [
          { cardId: defenderId, summonedTurn: 10 },
          { cardId: attackerId, summonedTurn: 9 },
        ],
      },
    })

    expect(evaluateBase(manager, 'playerA').boardMaterial).toBe(9)
    const preview = GameManager.previewCombat(manager, 1, 1)
    expect(preview.nextState.players.playerA.discard).toContain(defenderId)
    expect(evaluateBase(GameManager.from(preview.nextState), 'playerA').boardMaterial)
      .toBe(-6)
  })

  it('summons the test creature onto an empty board when six mana are available', () => {
    const manager = createHandManager()

    expect(new GameAI().chooseAction(manager)).toEqual({
      type: 'summonCreature',
      cardId: manager.state.players.playerA.hand[0],
      insertIndex: 0,
    })
  })
})
