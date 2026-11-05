import { useEffect, useRef } from 'react'

/* 
* Runs `fn` now and then every `intervalMs` after it finishes (never two at once).
* Pauses while the tab is hidden, runs again as soon as it's back, stops on unmount. `fn` handles its own errors
*/
const usePolling = (fn, intervalMs = 5000) => {
  const fnRef = useRef(fn)

  useEffect(() => {
    fnRef.current = fn // the latest fn without restarting the timer
  }, [fn])

  useEffect(() => {
    let timer = null
    let running = false
    let stopped = false

    const tick = async () => {
      running = true
      try {
        await fnRef.current()
      } catch {
        // fn shows its own errors: polling just goes on
      }
      running = false
      if (!stopped && !document.hidden) timer = setTimeout(tick, intervalMs)
    }

    const handleVisibility = () => {
      clearTimeout(timer)
      if (!document.hidden && !running) tick() // back on the tab: fresh data at once
    }

    tick()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      stopped = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [intervalMs])
}

export default usePolling
