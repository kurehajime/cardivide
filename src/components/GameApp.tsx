import { useMemo } from 'react'
import { GameManager } from '../game'
import BoardView from './BoardView'
import HandView from './HandView'
import PhaseBar from './PhaseBar'
import PlayerPanel from './PlayerPanel'

const GameApp = () => {
  const manager = useMemo(() => GameManager.create(), [])
  const { state } = manager
  const playerA = state.players.playerA
  const playerB = state.players.playerB
  const currentPlayer = GameManager.getCurrentPlayer(manager)

  return (
    <main className="game-shell">
      <header className="game-header">
        <h1>Card Line</h1>
        <PhaseBar phase={state.phase} turn={state.turn} activePlayer={currentPlayer.name} />
      </header>
      <HandView cards={playerB.hand} playerName={playerB.name} position="top" />
      <section className="tabletop" aria-label="game table">
        <PlayerPanel player={playerA} align="left" />
        <BoardView board={state.board} players={state.players} />
        <PlayerPanel player={playerB} align="right" />
      </section>
      <HandView cards={playerA.hand} playerName={playerA.name} position="bottom" />
    </main>
  )
}

export default GameApp
