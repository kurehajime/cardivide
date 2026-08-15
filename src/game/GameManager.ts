import type { GameState, Phase, PlayerId, PlayerState } from './types'

const createPlayer = (id: PlayerId, name: string): PlayerState => ({
  id,
  name,
  hp: 20,
  mana: 0,
  deck: [],
  hand: [],
  discard: [],
  formation: null,
})

const clonePlayer = (player: PlayerState): PlayerState => ({
  ...player,
  deck: [...player.deck],
  hand: [...player.hand],
  discard: [...player.discard],
})

const cloneGameState = (state: GameState): GameState => ({
  ...state,
  players: {
    playerA: clonePlayer(state.players.playerA),
    playerB: clonePlayer(state.players.playerB),
  },
  board: {
    creatures: state.board.creatures.map((creature) => ({ ...creature })),
  },
})

const createInitialState = (): GameState => ({
  turn: 1,
  activePlayerId: 'playerA',
  phase: 'keepUp',
  players: {
    playerA: createPlayer('playerA', 'Player A'),
    playerB: createPlayer('playerB', 'Player B'),
  },
  board: {
    creatures: [],
  },
})

export class GameManager {
  public readonly state: GameState

  private constructor(state: GameState) {
    this.state = state
  }

  static create(): GameManager {
    return new GameManager(createInitialState())
  }

  static from(state: GameState): GameManager {
    return new GameManager(cloneGameState(state))
  }

  static setPhase(manager: GameManager, phase: Phase): GameManager {
    return GameManager.from({
      ...manager.state,
      phase,
    })
  }

  static getCurrentPlayer(manager: GameManager): PlayerState {
    return manager.state.players[manager.state.activePlayerId]
  }

  static getOpponent(manager: GameManager): PlayerState {
    const opponentId = manager.state.activePlayerId === 'playerA' ? 'playerB' : 'playerA'
    return manager.state.players[opponentId]
  }
}
