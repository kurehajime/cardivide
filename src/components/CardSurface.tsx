import { useEffect, useState, type ReactNode, type RefObject } from 'react'
import { motion, useMotionTemplate, useReducedMotion, useSpring, useTransform, type MotionStyle } from 'motion/react'

type CardSurfaceProps = {
  cardRef: RefObject<HTMLElement | null>
  children: ReactNode
  foil: boolean
}

const SPRING = { stiffness: 180, damping: 24 }

const CardSurface = ({ cardRef, children, foil }: CardSurfaceProps) => {
  const [hovered, setHovered] = useState(false)
  const reduceMotion = useReducedMotion()
  const x = useSpring(50, SPRING)
  const y = useSpring(50, SPRING)
  const rotateX = useTransform(y, [0, 100], [9, -9])
  const rotateY = useTransform(x, [0, 100], [-9, 9])
  const pointerX = useMotionTemplate`${x}%`
  const pointerY = useMotionTemplate`${y}%`

  useEffect(() => {
    const card = cardRef.current
    if (!card) return

    const reset = () => {
      setHovered(false)
      x.set(50)
      y.set(50)
    }
    const move = (event: PointerEvent) => {
      if (reduceMotion || event.pointerType === 'touch' || !window.matchMedia('(hover: hover)').matches) return
      // Measure the stationary hit area, not the tilted visual surface.
      const rect = card.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      x.set(Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100)))
      y.set(Math.max(0, Math.min(100, (event.clientY - rect.top) / rect.height * 100)))
      setHovered(true)
    }
    reset()
    card.addEventListener('pointerenter', move)
    card.addEventListener('pointermove', move)
    card.addEventListener('pointerleave', reset)
    card.addEventListener('pointercancel', reset)
    window.addEventListener('blur', reset)
    return () => {
      card.removeEventListener('pointerenter', move)
      card.removeEventListener('pointermove', move)
      card.removeEventListener('pointerleave', reset)
      card.removeEventListener('pointercancel', reset)
      window.removeEventListener('blur', reset)
    }
  }, [cardRef, reduceMotion, x, y])

  return (
    <motion.div
      className="card-surface"
      data-hovered={hovered ? 'true' : undefined}
      style={{ rotateX, rotateY, '--card-pointer-x': pointerX, '--card-pointer-y': pointerY } as MotionStyle}
    >
      {children}
      {!foil && <div className="card-reflection" aria-hidden="true" />}
    </motion.div>
  )
}

export default CardSurface
