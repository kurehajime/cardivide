import { useEffect, useReducer } from 'react'
import { LayoutGroup, MotionConfig } from 'motion/react'
import {
  GameAI,
  GameManager,
  type ActivatedAbilityOption,
  type CardInstanceId,
} from '../game'
import BoardView from './BoardView'
import HandView from './HandView'
import PhaseBar from './PhaseBar'

const COMBAT_EFFECT_DURATION_MS = 500
const AI_ACTION_DELAY_MS = 300
const AI_PLAYER_ID = 'playerB'

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
  const winnerId = GameManager.getWinner(manager)
  const winnerMessage = winnerId === null ? null : `${state.players[winnerId].name}の勝利`
  const currentPlayer = GameManager.getCurrentPlayer(manager)
  const selectedCard = selectedCardId === null ? null : state.cards[selectedCardId] ?? null
  const playerAHand = playerA.hand.map((cardId) => state.cards[cardId])
  const playerBHand = playerB.hand.map((cardId) => state.cards[cardId])
  const boardGroups = GameManager.getBoardGroups(manager)
  const creatureStatModifiers = Object.fromEntries(
    state.board.creatures.map(({ cardId }) => [
      cardId,
      GameManager.getCreatureStatModifier(manager, cardId),
    ]),
  )
  const selectedSummonOptions =
    selectedCard?.card.kind === 'creature'
      ? GameManager.getSummonOptions(manager, selectedCard.id)
      : []
  const playableCardIds = new Set(
    currentPlayer.hand.filter((cardId) => GameManager.isCardPlayable(manager, cardId)),
  )
  const activatedAbilities = GameManager.getActivatedAbilities(manager)
  const playerDamageMarker =
    state.pendingCombat?.playerWasHit === true
      ? {
          playerId: state.pendingCombat.defendingPlayerId,
          damage: state.pendingCombat.playerDamage,
        }
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

  useEffect(() => {
    if (
      state.activePlayerId !== AI_PLAYER_ID ||
      state.pendingCombat !== null ||
      winnerId !== null
    ) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      dispatch({
        type: 'applyGameUpdate',
        update: (currentManager) => {
          if (
            currentManager.state.activePlayerId !== AI_PLAYER_ID ||
            currentManager.state.pendingCombat !== null ||
            GameManager.getWinner(currentManager) !== null
          ) {
            return currentManager
          }
          const action = GameAI.chooseAction(currentManager)
          return action === null
            ? currentManager
            : GameManager.applyAction(currentManager, action)
        },
      })
    }, AI_ACTION_DELAY_MS)

    return () => window.clearTimeout(timeoutId)
  }, [manager, state.activePlayerId, state.pendingCombat, winnerId])

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

  const handleActivateAbility = (ability: ActivatedAbilityOption) => {
    applyGameUpdate((currentManager) =>
      GameManager.activateAbility(
        currentManager,
        ability.sourceCardId,
        ability.abilityType,
      ),
    )
  }

  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ type: 'spring', stiffness: 420, damping: 36, mass: 0.8 }}
    >
      <LayoutGroup id="game-card-layout">
        <main className="game-shell">
          <header className="game-header">
            <h1>Card Line</h1>
            <div className="game-header-controls">
              <PhaseBar phase={state.phase} turn={state.turn} activePlayer={currentPlayer.name} />
              <button
                className="game-action-button"
                type="button"
                disabled={
                  state.activePlayerId === AI_PLAYER_ID ||
                  state.phase === 'keepUp' ||
                  state.pendingCombat !== null ||
                  winnerId !== null
                }
                onClick={handlePassPhase}
              >
                フェイズ進行
              </button>
              <button
                className="game-action-button"
                type="button"
                disabled={
                  state.activePlayerId === AI_PLAYER_ID ||
                  state.phase !== 'main' ||
                  selectedCard?.card.kind !== 'formation' ||
                  winnerId !== null
                }
                onClick={handlePlayFormation}
              >
                布陣に配置
              </button>
            </div>
          </header>
          {(winnerMessage ?? message) && (
            <div className="game-message" role="status">
              {winnerMessage ?? message}
            </div>
          )}
          <HandView
            cards={playerBHand}
            playerName={playerB.name}
            position="top"
            playableCardIds={undefined}
            active={state.activePlayerId === 'playerB'}
            disabled
            selectedCardId={null}
            onCardClick={handleCardClick}
          />
          <BoardView
            board={state.board}
            cards={state.cards}
            damageMarkers={state.pendingCombat?.damageMarkers ?? []}
            playerDamageMarker={playerDamageMarker}
            players={state.players}
            activePlayerId={state.activePlayerId}
            groups={boardGroups}
            creatureStatModifiers={creatureStatModifiers}
            summonOptions={selectedSummonOptions}
            activatedAbilities={
              state.activePlayerId === 'playerA' && winnerId === null
                ? activatedAbilities
                : []
            }
            canAttack={
              state.activePlayerId === 'playerA' &&
              ['main', 'battle'].includes(state.phase) &&
              !state.hasAttackedThisTurn &&
              state.pendingCombat === null &&
              winnerId === null
            }
            onInsertClick={handleInsertClick}
            onGroupAttack={handleGroupAttack}
            onActivateAbility={handleActivateAbility}
          />
          <HandView
            cards={playerAHand}
            playerName={playerA.name}
            position="bottom"
            playableCardIds={state.activePlayerId === 'playerA' ? playableCardIds : undefined}
            active={state.activePlayerId === 'playerA'}
            disabled={
              state.activePlayerId !== 'playerA' ||
              state.phase !== 'main' ||
              winnerId !== null
            }
            selectedCardId={state.activePlayerId === 'playerA' ? selectedCardId : null}
            onCardClick={handleCardClick}
          />
        </main>
      </LayoutGroup>
    </MotionConfig>
  )
}

export default GameApp
