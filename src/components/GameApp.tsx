import { useState } from 'react'
import { GameManager } from '../game'
import BoardView from './BoardView'
import HandView from './HandView'
import PhaseBar from './PhaseBar'
import PlayerPanel from './PlayerPanel'

const GameApp = () => {
  const [manager, setManager] = useState(() => GameManager.create())
  const [selectedHandIndex, setSelectedHandIndex] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const { state } = manager
  const playerA = state.players.playerA
  const playerB = state.players.playerB
  const currentPlayer = GameManager.getCurrentPlayer(manager)
  const selectedCard =
    selectedHandIndex === null ? null : currentPlayer.hand[selectedHandIndex] ?? null

  const handleResolveKeepUp = () => {
    applyGameUpdate((currentManager) => GameManager.resolveKeepUp(currentManager))
  }

  const handlePassPhase = () => {
    applyGameUpdate((currentManager) => GameManager.passPhase(currentManager))
  }

  const applyGameUpdate = (updater: (currentManager: GameManager) => GameManager) => {
    try {
      const nextManager = updater(manager)
      setManager(nextManager)
      setSelectedHandIndex(null)
      setMessage(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作できません。')
    }
  }

  const handleCardClick = (handIndex: number) => {
    setSelectedHandIndex((currentIndex) => (currentIndex === handIndex ? null : handIndex))
    setMessage(null)
  }

  const handleInsertClick = (insertIndex: number) => {
    if (selectedHandIndex === null) {
      setMessage('配置するカードを手札から選んでください。')
      return
    }

    applyGameUpdate((currentManager) =>
      GameManager.summonCreature(currentManager, selectedHandIndex, insertIndex),
    )
  }

  const handlePlayFormation = () => {
    if (selectedHandIndex === null) {
      setMessage('布陣に配置するカードを手札から選んでください。')
      return
    }

    applyGameUpdate((currentManager) => GameManager.playFormation(currentManager, selectedHandIndex))
  }

  const handleGroupAttack = (startIndex: number, endIndex: number) => {
    applyGameUpdate((currentManager) =>
      GameManager.attackGroup(currentManager, startIndex, endIndex),
    )
  }

  return (
    <main className="game-shell">
      <header className="game-header">
        <h1>Card Line</h1>
        <div className="game-header-controls">
          <PhaseBar phase={state.phase} turn={state.turn} activePlayer={currentPlayer.name} />
          <button
            className="game-action-button"
            type="button"
            disabled={state.phase !== 'keepUp'}
            onClick={handleResolveKeepUp}
          >
            キープアップ解決
          </button>
          <button
            className="game-action-button"
            type="button"
            disabled={state.phase === 'keepUp'}
            onClick={handlePassPhase}
          >
            フェイズ進行
          </button>
          <button
            className="game-action-button"
            type="button"
            disabled={state.phase !== 'main' || selectedCard?.kind !== 'formation'}
            onClick={handlePlayFormation}
          >
            布陣に配置
          </button>
        </div>
      </header>
      {message && <div className="game-message">{message}</div>}
      <HandView
        cards={playerB.hand}
        playerName={playerB.name}
        position="top"
        disabled={state.activePlayerId !== 'playerB' || state.phase !== 'main'}
        selectedIndex={state.activePlayerId === 'playerB' ? selectedHandIndex : null}
        onCardClick={handleCardClick}
      />
      <section className="tabletop" aria-label="game table">
        <PlayerPanel player={playerA} align="left" />
        <BoardView
          board={state.board}
          players={state.players}
          activePlayerId={state.activePlayerId}
          canInsert={state.phase === 'main' && selectedCard?.kind === 'creature'}
          canAttack={state.phase === 'battle' && !state.hasAttackedThisTurn}
          onInsertClick={handleInsertClick}
          onGroupAttack={handleGroupAttack}
        />
        <PlayerPanel player={playerB} align="right" />
      </section>
      <HandView
        cards={playerA.hand}
        playerName={playerA.name}
        position="bottom"
        disabled={state.activePlayerId !== 'playerA' || state.phase !== 'main'}
        selectedIndex={state.activePlayerId === 'playerA' ? selectedHandIndex : null}
        onCardClick={handleCardClick}
      />
    </main>
  )
}

export default GameApp
