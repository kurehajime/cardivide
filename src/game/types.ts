export const PLAYER_IDS = ['playerA', 'playerB'] as const

export type PlayerId = (typeof PLAYER_IDS)[number]

export type CardColor = 'red' | 'blue' | 'green'

export type CardKind = 'creature' | 'formation' | 'spell'

export type Phase = 'keepUp' | 'main' | 'battle' | 'cleanup'

export type AbilityText = string

export type CardBase = {
  id: string
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

export type CreatureInstance = {
  instanceId: string
  ownerId: PlayerId
  card: CreatureCard
  damage: number
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
  deck: Card[]
  hand: Card[]
  discard: Card[]
  formation: FormationCard | null
}

export type GameState = {
  turn: number
  activePlayerId: PlayerId
  phase: Phase
  players: Record<PlayerId, PlayerState>
  board: Board
}

export type GameAction =
  | { type: 'passPhase' }
  | { type: 'summonCreature'; cardId: string; insertIndex: number }
  | { type: 'playFormation'; cardId: string }
  | { type: 'playSpell'; cardId: string }
  | { type: 'attackGroup'; startIndex: number; endIndex: number }
