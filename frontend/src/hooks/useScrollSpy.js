import { useEffect, useState } from 'react'

const READING_BAND = '-25% 0px -65% 0px' // a section is "current" while it crosses the band between 25% and 35% of the viewport height, just under the sticky bars

const useScrollSpy = (ids) => { // ids of the sections in page order (keep the array stable with useMemo) --> id of the one being read
  const [activeId, setActiveId] = useState(null)

  useEffect(() => {
    const crossing = new Set()

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) crossing.add(entry.target.id)
        else crossing.delete(entry.target.id)
      }
      const current = ids.find((id) => crossing.has(id))
      if (current) setActiveId(current) // in the gap between two sections the last one stays active
    }, { rootMargin: READING_BAND })

    for (const id of ids) {
      const section = document.getElementById(id)
      if (section) observer.observe(section)
    }

    return () => observer.disconnect()
  }, [ids])

  return ids.includes(activeId) ? activeId : ids[0] ?? null // above the first section, or a search just hid the active one
}

export default useScrollSpy
