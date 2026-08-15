export const PLAYER_IDS = ['playerA', 'playerB'] as const

export type PlayerId = (typeof PLAYER_IDS)[number]

export type CardColor = 'red' | 'blue' | 'green'

export type CardKind = 'creature' | 'formation' | 'spell'

export type Phase = 'keepUp' | 'main' | 'battle' | 'cleanup'

export type AbilityText = string

export type CardInstanceId = number

export type CardBase = {
  definitionId: string
  name: string
  kind: CardKind
  cost: number
}

export type CreatureCard = CardBase & {
  kind: 'creature'
  color: CardColor
  attack: number
  defense: number
  march: number
  abilities: AbilityText[]
}

export type FormationCard = CardBase & {
  kind: 'formation'
  color: CardColor
  text: string
}

export type SpellCard = CardBase & {
  kind: 'spell'
  text: string
}

export type Card = CreatureCard | FormationCard | SpellCard

export type CardInstance = {
  id: CardInstanceId
  ownerId: PlayerId
  card: Card
}

export type CreatureInstance = {
  cardId: CardInstanceId
  summonedTurn: number
}

export type Board = {
  creatures: CreatureInstance[]
}

export type PlayerState = {
  id: PlayerId
  name: string
  hp: number
  mana: number
  deck: CardInstanceId[]
  hand: CardInstanceId[]
  discard: CardInstanceId[]
  formation: CardInstanceId | null
}

export type GameState = {
  turn: number
  activePlayerId: PlayerId
  phase: Phase
  hasAttackedThisTurn: boolean
  cards: Record<CardInstanceId, CardInstance>
  players: Record<PlayerId, PlayerState>
  board: Board
}

export type GameAction =
  | { type: 'resolveKeepUp' }
  | { type: 'passPhase' }
  | { type: 'summonCreature'; cardId: CardInstanceId; insertIndex: number }
  | { type: 'playFormation'; cardId: CardInstanceId }
  | { type: 'playSpell'; cardId: CardInstanceId }
  | { type: 'attackGroup'; startIndex: number; endIndex: number }
  | { type: 'discardFromHand'; cardId: CardInstanceId }
