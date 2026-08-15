import type { Phase } from '../game'

type PhaseBarProps = {
  phase: Phase
  turn: number
  activePlayer: string
}

const PHASE_LABELS: Record<Phase, string> = {
  keepUp: 'キープアップ',
  main: 'メイン',
  battle: '戦闘',
  cleanup: 'クリーンナップ',
}

const PhaseBar = ({ phase, turn, activePlayer }: PhaseBarProps) => (
  <div className="phase-bar">
    <span>Turn {turn}</span>
    <strong>{PHASE_LABELS[phase]}</strong>
    <span>{activePlayer}</span>
  </div>
)

export default PhaseBar
