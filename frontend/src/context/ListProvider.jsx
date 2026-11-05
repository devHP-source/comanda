import { useCallback, useEffect, useMemo, useState } from 'react'
import { ListContext } from './ListContext.js'

const STORAGE_KEY = 'comanda_list'

const readStoredList = () => { // dish ids in the order they were saved, anything unexpected is dropped
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return Array.isArray(stored) ? stored.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

const storeList = (ids) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // storage unavailable (private mode, blocked): the list lasts until the page is reloaded
  }
}

// "La mia lista": the guest's bookmarks, kept only in this browser. Not an order, nothing is sent to the server
export const ListProvider = ({ children }) => {
  const [ids, setIds] = useState(readStoredList)

  useEffect(() => {
    storeList(ids)
  }, [ids])

  const has = useCallback((id) => ids.includes(id), [ids])

  const toggle = useCallback((id) => {
    setIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }, [])

  // Dishes taken off the menu (or recreated by a reset) leave the list, so the counters stay right
  const keepOnly = useCallback((validIds) => {
    setIds((current) => {
      const next = current.filter((id) => validIds.has(id))
      return next.length === current.length ? current : next // same array: no re-render, no write
    })
  }, [])

  const value = useMemo(
    () => ({ ids, count: ids.length, has, toggle, keepOnly }),
    [ids, has, toggle, keepOnly],
  )

  return <ListContext value={value}>{children}</ListContext>
}
