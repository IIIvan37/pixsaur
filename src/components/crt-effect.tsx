import { useEffect, useRef } from 'react'
import styles from '@/styles/crt-effect.module.css'

export default function CrtEffect() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Create occasional glitch effect
    const createGlitch = () => {
      if (Math.random() > 0.1) {
        const glitch = document.createElement('div')
        glitch.className = styles.glitch
        glitch.style.top = `${Math.random() * 100}%`

        // Add animation
        glitch.style.animation = `${styles.glitch} ${
          100 + Math.random() * 200
        }ms linear`

        container.appendChild(glitch)

        // Remove glitch after animation
        glitch.addEventListener('animationend', () => {
          if (container.contains(glitch)) {
            container.removeChild(glitch)
          }
        })
      }
    }

    const glitchInterval = setInterval(createGlitch, 500)

    return () => {
      clearInterval(glitchInterval)
    }
  }, [])

  return (
    <div ref={containerRef} className={styles.container}>
      <div className={styles.scanlines}></div>
    </div>
  )
}
