import { useEffect, useReducer } from 'react'
import { GameManager, type CardInstanceId } from '../game'
import BoardView from './BoardView'
import HandView from './HandView'
import PhaseBar from './PhaseBar'
import PlayerPanel from './PlayerPanel'

const COMBAT_EFFECT_DURATION_MS = 500

type GameUiState = {
  manager: GameManager
  selectedCardId: CardInstanceId | null
  message: string | null
}

type GameUiAction =
  | { type: 'selectCard'; cardId: CardInstanceId }
  | { type: 'applyGameUpdate'; update: (manager: GameManager) => GameManager }

const createGameUiState = (): GameUiState => ({
  manager: GameManager.create(),
  selectedCardId: null,
  message: null,
})

const gameUiReducer = (state: GameUiState, action: GameUiAction): GameUiState => {
  if (action.type === 'selectCard') {
    return {
      ...state,
      selectedCardId: state.selectedCardId === action.cardId ? null : action.cardId,
      message: null,
    }
  }

  try {
    return {
      manager: action.update(state.manager),
      selectedCardId: null,
      message: null,
    }
  } catch (error) {
    return {
      ...state,
      message: error instanceof Error ? error.message : '操作できません。',
    }
  }
}

const GameApp = () => {
  const [{ manager, selectedCardId, message }, dispatch] = useReducer(
    gameUiReducer,
    undefined,
    createGameUiState,
  )
  const { state } = manager
  const playerA = state.players.playerA
  const playerB = state.players.playerB
  const currentPlayer = GameManager.getCurrentPlayer(manager)
  const selectedCard = selectedCardId === null ? null : state.cards[selectedCardId] ?? null
  const playerAHand = playerA.hand.map((cardId) => state.cards[cardId])
  const playerBHand = playerB.hand.map((cardId) => state.cards[cardId])
  const playerADamage =
    state.pendingCombat?.playerWasHit && state.pendingCombat.defendingPlayerId === 'playerA'
      ? state.pendingCombat.playerDamage
      : null
  const playerBDamage =
    state.pendingCombat?.playerWasHit && state.pendingCombat.defendingPlayerId === 'playerB'
      ? state.pendingCombat.playerDamage
      : null

  useEffect(() => {
    if (!state.pendingCombat) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      dispatch({
        type: 'applyGameUpdate',
        update: (currentManager) => GameManager.finishCombat(currentManager),
      })
    }, COMBAT_EFFECT_DURATION_MS)

    return () => window.clearTimeout(timeoutId)
  }, [state.pendingCombat])

  const applyGameUpdate = (update: (currentManager: GameManager) => GameManager) => {
    dispatch({ type: 'applyGameUpdate', update })
  }

  const handlePassPhase = () => {
    applyGameUpdate((currentManager) => GameManager.passPhase(currentManager))
  }

  const handleCardClick = (cardId: CardInstanceId) => {
    dispatch({ type: 'selectCard', cardId })
  }

  const handleInsertClick = (insertIndex: number) => {
    if (selectedCardId === null) {
      return
    }

    applyGameUpdate((currentManager) =>
      GameManager.summonCreature(currentManager, selectedCardId, insertIndex),
    )
  }

  const handlePlayFormation = () => {
    if (selectedCardId === null) {
      return
    }

    applyGameUpdate((currentManager) =>
      GameManager.playFormation(currentManager, selectedCardId),
    )
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
            disabled={state.phase === 'keepUp' || state.pendingCombat !== null}
            onClick={handlePassPhase}
          >
            フェイズ進行
          </button>
          <button
            className="game-action-button"
            type="button"
            disabled={state.phase !== 'main' || selectedCard?.card.kind !== 'formation'}
            onClick={handlePlayFormation}
          >
            布陣に配置
          </button>
        </div>
      </header>
      {message && <div className="game-message">{message}</div>}
      <HandView
        cards={playerBHand}
        playerName={playerB.name}
        position="top"
        disabled={state.activePlayerId !== 'playerB' || state.phase !== 'main'}
        selectedCardId={state.activePlayerId === 'playerB' ? selectedCardId : null}
        onCardClick={handleCardClick}
      />
      <section className="tabletop" aria-label="game table">
        <PlayerPanel
          player={playerA}
          cards={state.cards}
          align="left"
          damage={playerADamage}
        />
        <BoardView
          board={state.board}
          cards={state.cards}
          damageMarkers={state.pendingCombat?.damageMarkers ?? []}
          players={state.players}
          activePlayerId={state.activePlayerId}
          canInsert={state.phase === 'main' && selectedCard?.card.kind === 'creature'}
          canAttack={
            ['main', 'battle'].includes(state.phase) &&
            !state.hasAttackedThisTurn &&
            state.pendingCombat === null
          }
          onInsertClick={handleInsertClick}
          onGroupAttack={handleGroupAttack}
        />
        <PlayerPanel
          player={playerB}
          cards={state.cards}
          align="right"
          damage={playerBDamage}
        />
      </section>
      <HandView
        cards={playerAHand}
        playerName={playerA.name}
        position="bottom"
        disabled={state.activePlayerId !== 'playerA' || state.phase !== 'main'}
        selectedCardId={state.activePlayerId === 'playerA' ? selectedCardId : null}
        onCardClick={handleCardClick}
      />
    </main>
  )
}

export default GameApp
