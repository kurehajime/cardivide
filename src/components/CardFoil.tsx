import { useState } from 'react'
import { useReducedMotion } from 'motion/react'

const CardFoil = ({ flashOnMount = false }: { flashOnMount?: boolean }) => {
  const reducedMotion = useReducedMotion()
  // Remove the animation after play so DOM reordering cannot restart it.
  const [flashFinished, setFlashFinished] = useState(false)
  const flashClass = flashOnMount && !flashFinished && !reducedMotion
    ? ' card-foil-playing'
    : ''

  return (
    <>
      <div
        className={`card-foil-layer card-foil-rainbow${flashClass}`}
        aria-hidden="true"
        onAnimationEnd={() => setFlashFinished(true)}
      />
      <div className="card-foil-layer card-foil-grain" aria-hidden="true" />
      <div className={`card-foil-layer card-foil-glare${flashClass}`} aria-hidden="true" />
    </>
  )
}

export default CardFoil
