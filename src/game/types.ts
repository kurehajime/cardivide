export const PLAYER_IDS = ['playerA', 'playerB'] as const

export type PlayerId = (typeof PLAYER_IDS)[number]

export type CardColor = 'red' | 'blue' | 'green'

export type CardKind = 'creature' | 'formation' | 'spell'

export type Phase = 'keepUp' | 'main' | 'battle' | 'cleanup'

export type CardInstanceId = number

export type KeywordAbility =
  | { type: 'summoningSickness' }
  | { type: 'vanish' }
  | { type: 'loneWarrior'; attack: number; defense: number }
  | { type: 'withdraw' }
  | { type: 'assassin'; attack: number }
  | { type: 'counter' }
  | { type: 'return' }
  | { type: 'beachhead'; costReduction: number }
  | { type: 'capture'; marchTax: number }
  | { type: 'mining'; mana: number }
  | { type: 'rearguard'; attack: number; defense: number }

export type KeywordAbilityType = KeywordAbility['type']

export type ActivatedAbilityType = Extract<
  KeywordAbilityType,
  'withdraw' | 'return'
>

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
  abilities: KeywordAbility[]
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

export type DamageMarker = {
  cardId: CardInstanceId
  damage: number
}

export type CreatureStatModifier = {
  attack: number
  defense: number
}

export type EffectiveCreatureStats = {
  attack: number
  defense: number
  march: number
}

export type KeepUpManaContribution = {
  amount: number
  stackKey: string
}

export type SummonOption = {
  insertIndex: number
  requiredMarch: number
  effectiveCost: number
  canReach: boolean
  affordable: boolean
  canSummon: boolean
}

export type ActivatedAbilityOption = {
  sourceCardId: CardInstanceId
  abilityType: ActivatedAbilityType
  label: string
  enabled: boolean
  reason?: string
}

export type ActivatedAbilityResolution = {
  destination: 'discard' | 'hand'
  mana: number
}

export type EffectiveBoardGroup = {
  ownerId: PlayerId
  startIndex: number
  endIndex: number
  attack: number
  defense: number
}

export type PendingCombat = {
  damageMarkers: DamageMarker[]
  destroyedCardIds: CardInstanceId[]
  defendingPlayerId: PlayerId
  playerWasHit: boolean
  playerDamage: number
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
  pendingCombat: PendingCombat | null
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
  | { type: 'finishCombat' }
  | {
      type: 'activateAbility'
      sourceCardId: CardInstanceId
      abilityType: ActivatedAbilityType
    }
  | { type: 'discardFromHand'; cardId: CardInstanceId }
