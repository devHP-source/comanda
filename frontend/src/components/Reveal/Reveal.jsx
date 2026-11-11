import { useEffect, useRef, useState } from 'react'
import styles from './Reveal.module.css'

/*
* Fades its content in the first time it scrolls into view.
* The hidden start state is only in the CSS under prefers-reduced-motion: no-preference,
* so with reduced motion (or without IntersectionObserver) the content is simply there
*/
const Reveal = ({ children, className = '' }) => {
  const ref = useRef(null)
  const [isVisible, setIsVisible] = useState(() => typeof IntersectionObserver === 'undefined')

  useEffect(() => {
    if (isVisible) return

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      setIsVisible(true)
      observer.disconnect() // once shown, it stays
    }, { rootMargin: '0px 0px -10% 0px' }) // starts a little after the block enters the screen

    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [isVisible])

  return (
    <div ref={ref} className={`${styles.reveal} ${isVisible ? styles.visible : ''} ${className}`}>
      {children}
    </div>
  )
}

export default Reveal
