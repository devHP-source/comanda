import { useEffect, useState } from 'react'
import openStatus from '../utils/restaurantClock.js'

const MINUTE_MS = 60 * 1000

/*
* open | closedToday | closedNow (null until the settings arrive), checked again at every new minute,
* so the line changes at opening and closing time without a reload. Back on the tab: checked at once
*/
const useOpenStatus = (settings) => {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let timer = null

    const tick = () => {
      setNow(new Date())
      timer = setTimeout(tick, MINUTE_MS - (Date.now() % MINUTE_MS)) // on the minute, like the "HH:mm" hours
    }

    const handleVisibility = () => {
      if (document.hidden) return
      clearTimeout(timer)
      tick()
    }

    timer = setTimeout(tick, MINUTE_MS - (Date.now() % MINUTE_MS))
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  return settings ? openStatus(settings, now) : null
}

export default useOpenStatus
